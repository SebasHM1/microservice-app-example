'use strict';
const express = require('express');
const bodyParser = require("body-parser");
const jwt = require('express-jwt');
const { Client } = require('pg');
const redis = require("redis");

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

    const REDIS_CHANNEL = process.env.REDIS_CHANNEL;
    const REDIS_HOST = process.env.REDIS_HOST;
    const REDIS_PORT = process.env.REDIS_PORT;
    const TODO_API_PORT = process.env.TODOS_API_PORT;
    const JWT_SECRET = process.env.JWT_SECRET;
    const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

    // Configuración de Redis
    const redisClient = redis.createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        tls: true
      },
      password: REDIS_PASSWORD
    });

redisClient.connect()
  .then(() => console.log("Redis conectado"))
  .catch((err) => console.error("Error conectando a Redis", err));

    const logChannel = REDIS_CHANNEL;
    const app = express();

    // Configuración de Zipkin (tracing)
    const ctxImpl = new CLSContext('zipkin');
    const recorder = new BatchRecorder({
      logger: new HttpLogger({
        endpoint: ZIPKIN_URL,
        jsonEncoder: JSON_V2
      })
    });

    // Middleware
    app.use(jwt({ secret: JWT_SECRET }));
    app.use(function (err, req, res, next) {
      if (err.name === 'UnauthorizedError') {
        res.status(401).send({ message: 'invalid token' });
      }
    });
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());

    // Rutas
    const routes = require('./routes');
    routes(app, { redisClient, logChannel });

    // Iniciar el servidor
    app.listen(TODO_API_PORT, function () {
      console.log('todo list RESTful API server started on: ' + TODO_API_PORT);
    });
  } catch (err) {
    console.error('Failed to start the server:', err);
    process.exit(1); // Salir con un código de error si algo falla
  }
})();
