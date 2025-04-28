'use strict';
const express = require('express');
const bodyParser = require("body-parser");
const jwt = require('express-jwt');
const { Client } = require('pg');
const cors = require('cors'); // <--- 1. Importar cors

// const logChannel = process.env.REDIS_CHANNEL || 'log_channel';
const redis = require("redis");
const retry = require('async-retry');

async function loadEnvVariablesFromDB() {
  await retry(async (bail) => {
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

      // Si el error es crítico, no reintentar
      if (err.code === 'ECONNREFUSED') {
        bail(err); // Detener los reintentos
      }

      throw err; // Reintentar en caso de otros errores
    } finally {
      await client.end();
    }
  }, {
    retries: 5, // Número máximo de reintentos
    factor: 2, // Incremento exponencial del tiempo entre reintentos
    minTimeout: 1000, // Tiempo mínimo entre reintentos (1 segundo)
    maxTimeout: 5000, // Tiempo máximo entre reintentos (5 segundos)
    onRetry: (err, attempt) => {
      console.log(`Retrying to load environment variables... Attempt #${attempt}`);
    },
  });
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

    const redisClient = redis.createClient({
      socket: {
        host: REDIS_HOST,
        
        // Asegúrate que REDIS_PORT tenga el valor del puerto TLS de Upstash
        port: REDIS_PORT, // Añadido parseInt por si acaso
        tls: true,
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
        } // Correcto para Upstash
        // Puedes añadir opciones de reintento si lo deseas
        // reconnectStrategy: retries => Math.min(retries * 50, 500)
      },
      password: process.env.REDIS_PASSWORD
    });

// ---> Listener para eventos de conexión <---
redisClient.on('connect', () => {
    console.log('Redis: Cliente conectando...');
});

redisClient.on('ready', () => {
    console.log('Redis: Cliente listo y conectado.'); // Este es un mejor indicador
});

// ---> ¡Listener de ERRORES ESENCIAL! <---
redisClient.on('error', (err) => {
    // Esto evitará que la app crashee por errores de Redis no manejados
    console.error('Redis Client Error:', err);
    // Aquí podrías añadir lógica de reintento o notificación si es necesario
});

redisClient.on('end', () => {
    console.log('Redis: Conexión cerrada.');
});

// Conectar e inicializar
async function initializeRedis() {
    try {
        await redisClient.connect();
        // Ahora el listener 'ready' confirmará la conexión
    } catch (err) {
        console.error("Redis: Fallo al conectar inicialmente:", err);
        // Considera salir si la conexión inicial es crítica
        process.exit(1);
    }
}

initializeRedis(); // Llama a la función de conexión

const port = process.env.TODO_API_PORT;
const jwtSecret = process.env.JWT_SECRET;

const app = express();

// --- 2. Configurar y usar CORS ---
const corsOptions = {
  // ¡IMPORTANTE! Especifica el origen exacto de tu frontend
  origin: 'https://frontend-production-af38.up.railway.app',
  // Métodos permitidos (incluye OPTIONS para preflight)
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  // Cabeceras permitidas (¡IMPORTANTE incluir Authorization para JWT!)
  allowedHeaders: 'Content-Type, Authorization',
  // Opcional: Si necesitas enviar cookies o usar credenciales (puede que no sea necesario aquí)
  // credentials: true
};
app.use(cors(corsOptions));
// Alternativa rápida (menos segura, permite cualquier origen):
// app.use(cors()); // <-- ¡Cuidado en producción si manejas datos sensibles!

app.use(jwt({ secret: jwtSecret, algorithms: ['HS256'] })); // Especificar algoritmo es buena práctica
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).send({ message: 'invalid token' }); // Añadido return
  }
  next(err); // Pasar otros errores
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Asegúrate de pasar el cliente inicializado
const routes = require('./routes');
routes(app, { redisClient, logChannel }); // Pasas el cliente aquí

app.listen(port, function () {
  console.log('todo list RESTful API server started on: ' + port);
});

// Manejo elegante de cierre (opcional pero bueno)
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing Redis connection.');
    await redisClient.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing Redis connection.');
    await redisClient.quit();
    process.exit(0);
});
} catch (err)  
  {console.log("Error creando el cliente Redis")}
})();