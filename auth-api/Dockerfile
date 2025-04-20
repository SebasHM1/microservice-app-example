FROM golang:1.19
WORKDIR /app
COPY . .
RUN go mod download
RUN go build -o auth-api

EXPOSE 8000

CMD ["./auth-api"]
