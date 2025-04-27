# ─── Etapa de build ─────────────────────────────────
FROM node:8.17.0 AS build
WORKDIR /app

# 1) Copia definiciones de entorno antes de instalar/build
ARG VUE_APP_AUTH_API_ADDRESS
ARG VUE_APP_TODOS_API_ADDRESS
ENV VUE_APP_AUTH_API_ADDRESS=$VUE_APP_AUTH_API_ADDRESS
ENV VUE_APP_TODOS_API_ADDRESS=$VUE_APP_TODOS_API_ADDRESS

# 2) Instalación y build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build               # Aquí se bakean las vars VUE_APP_* en el bundle

# Etapa final: servir con "serve"
FROM node:8.17.0
WORKDIR /app
COPY --from=build /app/dist ./dist

# Instala el servidor estático
RUN npm install -g serve

# EXPONE el puerto (opcional, Railway infiere de $PORT)
EXPOSE 8080

# Usa $PORT como escucha
CMD ["sh", "-c", "serve -s dist -l $PORT"]
