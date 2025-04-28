'use strict';
const express = require('express');
const bodyParser = require("body-parser");
const jwt = require('express-jwt');
const cors = require('cors'); // <--- 1. Importar cors

const logChannel = process.env.REDIS_CHANNEL || 'log_channel';
const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    // Asegúrate que REDIS_PORT tenga el valor del puerto TLS de Upstash
    port: parseInt(process.env.REDIS_PORT || '6379', 10), // Añadido parseInt por si acaso
    tls: true // Correcto para Upstash
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

const port = process.env.TODO_API_PORT || 8082;
const jwtSecret = process.env.JWT_SECRET || "foo";

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