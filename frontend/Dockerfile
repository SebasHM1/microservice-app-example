# Usar una imagen base de Python
FROM python:3.11-alpine

# Instalar Node.js y dependencias necesarias
RUN apk add --no-cache \
    nodejs \
    npm \
    make \
    g++ \
    libc6-compat \
    nginx

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias de Node.js
COPY package*.json ./

# Reemplazar node-sass con sass (para evitar problemas con node-gyp)
RUN npm uninstall node-sass && npm install sass

# Instalar dependencias del frontend
RUN npm install --legacy-peer-deps

# Copiar el resto del código fuente
COPY . .

# Construir la aplicación Vue
RUN npm run build

# Configurar Nginx para servir la aplicación
RUN mkdir -p /run/nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer el puerto de Nginx
EXPOSE 80

# Iniciar Nginx al ejecutar el contenedor
CMD ["nginx", "-g", "daemon off;"]
