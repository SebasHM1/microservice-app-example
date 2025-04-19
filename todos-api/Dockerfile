FROM node:8.17.0-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8082

CMD ["npm", "start"]