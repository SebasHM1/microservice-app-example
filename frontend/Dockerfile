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

# ─── Etapa de producción ────────────────────────────
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
