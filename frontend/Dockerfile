FROM python:3.11-alpine

# Instalar dependencias necesarias
RUN apk add --no-cache \
    nodejs \
    npm \
    nginx

WORKDIR /app

# Copiar dependencias (ya sin node-sass)
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Construir el frontend
RUN npm run build

# Copiar al folder que servirá nginx
RUN mkdir -p /var/www/html && cp -r dist/* /var/www/html/

# Configurar nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
