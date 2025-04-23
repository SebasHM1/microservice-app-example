FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Definimos variables de entorno (sin valores hardcodeados!)
ENV REDIS_HOST=${REDIS_HOST}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV REDIS_PORT=${REDIS_PORT}
ENV REDIS_CHANNEL=${REDIS_CHANNEL}

EXPOSE 8082

CMD ["npm", "start"]