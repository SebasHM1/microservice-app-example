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

# Definimos variables de entorno (sin valores hardcodeados!)
ENV REDIS_HOST=${REDIS_HOST}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV REDIS_PORT=${REDIS_PORT}
ENV REDIS_CHANNEL=${REDIS_CHANNEL}

# Comando por defecto al iniciar
# CMD ["python", "main.py"] # <-- Comenta el original
CMD ["python", "-c", "import sys; print('Test Python Print OK', file=sys.stderr)"]
