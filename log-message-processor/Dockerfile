# Imagen base con Python 3.6
FROM python:3.6-slim

# Evitamos preguntas durante instalación
ENV DEBIAN_FRONTEND=noninteractive

# Copiamos archivos al contenedor
WORKDIR /app
COPY . .

# Instalamos dependencias del sistema (y reintentamos si falla)
RUN apt-get update && apt-get install -y --fix-missing \
    gcc \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalamos dependencias de Python
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Variables de entorno por defecto (puedes sobreescribirlas al ejecutar)
ENV REDIS_HOST=127.0.0.1
ENV REDIS_PORT=6379
ENV REDIS_CHANNEL=log_channel

# Comando por defecto al iniciar
CMD ["python", "main.py"]
