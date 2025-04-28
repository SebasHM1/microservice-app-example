import time
import redis
import os
import json
import requests
# Quita las importaciones de Zipkin si ya no lo usas, si no, déjalas
# from py_zipkin.zipkin import zipkin_span, ZipkinAttrs, generate_random_64bit_string
import time
import random
import sys # <--- 1. Importa sys para sys.exit

# --- IMPORTANTE: Añade la importación que falta ---
import psycopg2 # <--- 2. Importa psycopg2

def load_env_variables_from_db():
    """Load environment variables from the PostgreSQL database."""
    # Nota: Idealmente, esta connection string también vendría de una variable de entorno
    #       configurada en Railway, en lugar de estar hardcodeada aquí.
    #       Pero para solucionar el error actual, la dejamos así por ahora.
    connection_string = os.getenv("DB_CONNECTION_STRING", 'postgresql://neondb_owner:npg_qs9gLMJPw4SI@ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb?sslmode=require')
    # Si connection_string está vacío después de intentar leer de env var, salimos.
    if not connection_string:
        print("Error: DB_CONNECTION_STRING environment variable not set and no default provided.")
        sys.exit(1)

    conn = None # <--- 3. Inicializa conn a None antes del try
    try:
        print("Connecting to database to load configuration...") # Añadido log
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        # Asegúrate de que el nombre de la tabla sea correcto ('env' o 'configuration_table'?)
        cursor.execute('SELECT name, value FROM env')
        rows = cursor.fetchall()
        cursor.close() # Cierra el cursor tan pronto como termines con él
        print(f"Fetched {len(rows)} variables from database.") # Añadido log
        for name, value in rows:
            print(f"Setting os.environ['{name}']") # Log más informativo
            os.environ[name] = value
        print('Environment variables loaded successfully from database.') # Mensaje de éxito
    # Captura errores específicos de psycopg2 y errores generales
    except (psycopg2.Error, Exception) as e:
        print(f'Error loading environment variables from database: {e}')
        # Es mejor usar sys.exit para terminar el script
        sys.exit(1) # <--- 4. Usa sys.exit(1)
    finally:
        # Cierra la conexión SOLO si se estableció con éxito
        if conn is not None: # <--- 5. Comprueba si conn NO es None
            print("Closing database connection.") # Añadido log
            conn.close()

def log_message(message):
    # Considera si esta lógica de Zipkin debe eliminarse por completo
    # if not zipkin_url or 'zipkinSpan' not in message: # Ejemplo si quisieras quitar Zipkin
    #     time_delay = random.randrange(0, 2000)
    #     time.sleep(time_delay / 1000)
    #     print('message received after waiting for {}ms: {}'.format(time_delay, message))
    #     return
    # # ... resto de la lógica de Zipkin ...
    # else: # Bloque original si mantienes Zipkin
    time_delay = random.randrange(0, 2000)
    time.sleep(time_delay / 1000)
    print('message received after waiting for {}ms: {}'.format(time_delay, message))


import time
import redis
import os
import json
import sys
import psycopg2

# ... (función load_env_variables_from_db sigue igual) ...
# ... (función log_message sigue igual) ...


def create_redis_connection(redis_host, redis_port, redis_password):
    """Crea y prueba una nueva conexión Redis."""
    print(f"Attempting to connect to Redis: {redis_host}:{redis_port}...")
    try:
        r = redis.Redis(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            ssl=True,
            ssl_cert_reqs=None, # Puede ser necesario
            db=0,
            socket_connect_timeout=10,
            socket_timeout=None,  # <--- IMPORTANTE: Deshabilita timeout de lectura para listen()
            # socket_keepalive=True # <-- NO DISPONIBLE en v2.10.6
        )
        r.ping()
        print("Redis connection successful (ping).")
        return r
    except redis.exceptions.ConnectionError as e:
        print(f"Error connecting to Redis: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error during Redis connection: {e}")
        return None


if __name__ == '__main__':

    print("Starting log-message-processor...")
    load_env_variables_from_db()

    try:
        redis_host = os.environ['REDIS_HOST']
        redis_port = int(os.environ['REDIS_PORT'])
        redis_channel = os.environ['REDIS_CHANNEL']
        redis_password = os.environ.get('REDIS_PASSWORD')
    except KeyError as e:
        print(f"Error: Missing required environment variable: {e}")
        sys.exit(1)

    redis_conn = None
    pubsub = None
    backoff_time = 1 # Segundos iniciales para esperar antes de reconectar

    while True: # Bucle principal para mantener la conexión/subscripción
        if redis_conn is None or pubsub is None:
            redis_conn = create_redis_connection(redis_host, redis_port, redis_password)
            if redis_conn:
                try:
                    pubsub = redis_conn.pubsub(ignore_subscribe_messages=True)
                    pubsub.subscribe(redis_channel)
                    print(f"Subscribed to Redis channel '{redis_channel}'. Waiting for messages...")
                    backoff_time = 1 # Resetea el backoff al conectar exitosamente
                except Exception as e:
                    print(f"Error setting up pubsub/subscribing: {e}")
                    redis_conn = None # Falla la configuración, intentar reconectar
                    pubsub = None
            else:
                 # Falló la conexión, esperar antes de reintentar
                 print(f"Will retry Redis connection in {backoff_time} seconds...")
                 time.sleep(backoff_time)
                 backoff_time = min(backoff_time * 2, 60) # Incrementa espera hasta 60s
                 continue # Vuelve al inicio del while para reintentar conectar

        # Si tenemos conexión y pubsub, intentamos escuchar
        try:
            print("Entering pubsub.listen() loop...")
            for item in pubsub.listen():
                 # El item debería ser solo de tipo 'message'
                print(f"Received raw item: {item}") # Log
                if item['type'] == 'message':
                    try:
                        message_data = item['data'].decode("utf-8")
                        try:
                            message_content = json.loads(message_data)
                        except json.JSONDecodeError:
                            message_content = message_data # Tratar como texto

                        log_message(message_content) # Procesar el mensaje

                    except Exception as e:
                         print(f"Error processing received message: {e}. Raw data: {item.get('data')}")

            # Si listen() termina, puede indicar un problema. Forzamos reconexión.
            print("pubsub.listen() exited. Forcing reconnect.")
            if pubsub: pubsub.close() # Cierra pubsub viejo
            if redis_conn: redis_conn.close() # Cierra conexión vieja
            redis_conn, pubsub = None, None


        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as e:
            # TimeoutError puede ocurrir si el socket se cierra externamente aunque tengamos socket_timeout=None
            print(f"Redis Error during listen ({type(e).__name__}): {e}. Attempting reconnect...")
            if pubsub: pubsub.close()
            if redis_conn: redis_conn.close()
            redis_conn, pubsub = None, None # Fuerza la reconexión en la siguiente iteración del while
            # Espera un poco antes de intentar reconectar en el bucle principal
            time.sleep(backoff_time)
            backoff_time = min(backoff_time * 2, 60)

        except Exception as e:
            print(f"Unexpected error during pubsub.listen loop: {e}")
            # Decide qué hacer, por ahora reconectar
            if pubsub: pubsub.close()
            if redis_conn: redis_conn.close()
            redis_conn, pubsub = None, None
            time.sleep(5) # Espera antes de reintentar