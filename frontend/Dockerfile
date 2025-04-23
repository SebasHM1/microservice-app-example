FROM node:8.17.0

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Ejecutar el script para cargar las variables de entorno antes de construir
RUN node config/load-env.js

RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV AUTH_API_ADDRESS=${AUTH_API_ADDRESS}
ENV TODOS_API_ADDRESS=${TODOS_API_ADDRESS}

CMD ["npm", "start"]