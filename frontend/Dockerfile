FROM node:8.17.0

WORKDIR /app

COPY .env.development .env.production ./

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

ENV PORT=8080
ENV AUTH_API_ADDRESS=${AUTH_API_ADDRESS}
ENV TODOS_API_ADDRESS=${TODOS_API_ADDRESS}

CMD ["npm", "start"]