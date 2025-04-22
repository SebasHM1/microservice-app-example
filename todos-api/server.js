'use strict';
const express = require('express');
const bodyParser = require("body-parser");
const jwt = require('express-jwt');
const { Client } = require('pg');
const redis = require("redis");
const {Tracer, BatchRecorder, jsonEncoder: { JSON_V2 }} = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const {HttpLogger} = require('zipkin-transport-http');
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;

// Función para cargar las variables de entorno desde la base de datos
async function loadEnvVariablesFromDB() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_qs9gLMJPw4SI@ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb',
    ssl: {
      rejectUnauthorized: false, // Permitir conexiones SSL sin verificar el certificado
    },
  });

  try {
    await client.connect();

    const res = await client.query('SELECT name, value FROM env');
    res.rows.forEach(row => {
      process.env[row.name] = row.value; // Cargar cada variable en process.env
    });

    console.log('Environment variables loaded from database.');
    console.log('Rows from database:', res.rows);
  } catch (err) {
    console.error('Error loading environment variables from database:', err);
    throw err; // Lanzar el error si no se pueden cargar las variables
  } finally {
    await client.end();
  }
}

(async () => {
  try {
    // Cargar las variables de entorno desde la base de datos antes de inicializar la aplicación
    await loadEnvVariablesFromDB();

    const ZIPKIN_URL = process.env.ZIPKIN_URL;
    const REDIS_CHANNEL = process.env.REDIS_CHANNEL;
    const REDIS_HOST = process.env.REDIS_HOST;
    const REDIS_PORT = process.env.REDIS_PORT;
    const TODO_API_PORT = process.env.TODOS_API_PORT;
    const JWT_SECRET = process.env.JWT_SECRET;

    // Configuración de Redis
    const redisClient = redis.createClient({
      host: REDIS_HOST,
      port: REDIS_PORT,
      retry_strategy: function (options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          console.log('reattempting to connect to redis, attempt #' + options.attempt);
          return undefined;
        }
        return Math.min(options.attempt * 100, 2000);
      }
    });

    const app = express();

    // Configuración de Zipkin (tracing)
    const ctxImpl = new CLSContext('zipkin');
    const recorder = new BatchRecorder({
      logger: new HttpLogger({
        endpoint: ZIPKIN_URL,
        jsonEncoder: JSON_V2
      })
    });
    const localServiceName = 'todos-api';
    const tracer = new Tracer({ ctxImpl, recorder, localServiceName });

    // Middleware
    app.use(jwt({ secret: JWT_SECRET }));
    app.use(zipkinMiddleware({ tracer }));
    app.use(function (err, req, res, next) {
      if (err.name === 'UnauthorizedError') {
        res.status(401).send({ message: 'invalid token' });
      }
    });
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    // Rutas
    const routes = require('./routes');
    routes(app, { tracer, redisClient, logChannel: REDIS_CHANNEL });

    // Iniciar el servidor
    app.listen(TODO_API_PORT, function () {
      console.log('todo list RESTful API server started on: ' + TODO_API_PORT);
    });
  } catch (err) {
    console.error('Failed to start the server:', err);
    process.exit(1); // Salir con un código de error si algo falla
  }
})();
