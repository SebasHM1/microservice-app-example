'use strict';
const express = require('express')
const bodyParser = require("body-parser")
const jwt = require('express-jwt')

const logChannel = process.env.REDIS_CHANNEL || 'log_channel';
const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: true
  },
  password: process.env.REDIS_PASSWORD
});

redisClient.connect()
  .then(() => console.log("Redis conectado"))
  .catch((err) => console.error("Error conectando a Redis", err));

const port = process.env.TODO_API_PORT || 8082
const jwtSecret = process.env.JWT_SECRET || "foo"

const app = express()

// tracing

app.use(jwt({ secret: jwtSecret }))
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send({ message: 'invalid token' })
  }
})
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const routes = require('./routes')
routes(app, {redisClient, logChannel})

app.listen(port, function () {
  console.log('todo list RESTful API server started on: ' + port)
})
