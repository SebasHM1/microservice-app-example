# --- BLOQUE ÚNICO DE IMPORTACIONES ---
import time
import redis
import os
import json
import sys
import psycopg2
# Quita 'requests' y 'random' si ya no los usas directamente
# import requests
# import random

# --- DEFINICIONES DE FUNCIONES (UNA SOLA VEZ) ---

def load_env_variables_from_db():
    """Load environment variables from the PostgreSQL database."""
    print("DEBUG: Entered load_env_variables_from_db") # Log de depuración
    connection_string = os.getenv("DB_CONNECTION_STRING", 'postgresql://neondb_owner:npg_qs9gLMJPw4SI@ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb?sslmode=require')
    if not connection_string:
        print("Error: DB_CONNECTION_STRING environment variable not set and no default provided.")
        sys.exit(1)

    conn = None
    try:
        print("Connecting to database to load configuration...")
        conn = psycopg2.connect(connection_string)
        cursor = conn.cursor()
        cursor.execute('SELECT name, value FROM env') # Verifica nombre de tabla
        rows = cursor.fetchall()
        cursor.close()
        print(f"Fetched {len(rows)} variables from database.")
        for name, value in rows:
            print(f"Setting os.environ['{name}']")
            os.environ[name] = value
        print('Environment variables loaded successfully from database.')
    except (psycopg2.Error, Exception) as e:
        print(f'Error loading environment variables from database: {e}')
        sys.exit(1)
    finally:
        if conn is not None:
            print("Closing database connection.")
            conn.close()

def log_message(message):
    """Logs the received message with a random delay."""
    # Nota: El time.sleep aleatorio podría ser contraproducente en un procesador de logs.
    # Considera quitarlo o hacerlo muy pequeño si causa problemas de rendimiento/orden.
    # time_delay = random.randrange(0, 50) # Delay más corto
    # time.sleep(time_delay / 1000)
    print(f'Message received: {message}') # Log más simple

def create_redis_connection(redis_host, redis_port, redis_password):
    """Creates and tests a new Redis connection."""
    print(f"Attempting to connect to Redis: {redis_host}:{redis_port}...")
    try:
        r = redis.Redis(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            ssl=True,
            ssl_cert_reqs=None,
            db=0,
            socket_connect_timeout=10,
            socket_timeout=None, # Para listen()
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

# --- BLOQUE PRINCIPAL ---
if __name__ == '__main__':
    print("DEBUG: Inside if __name__ == '__main__'") # Log de depuración

    print("Starting log-message-processor...")
    load_env_variables_from_db() # Carga configuración primero

    try:
        redis_host = os.environ['REDIS_HOST']
        redis_port = int(os.environ['REDIS_PORT'])
        redis_channel = os.environ['REDIS_CHANNEL']
        redis_password = os.environ.get('REDIS_PASSWORD')
    except KeyError as e:
        print(f"Error: Missing required environment variable after DB load: {e}")
        sys.exit(1)
    except ValueError as e:
         print(f"Error: REDIS_PORT is not a valid integer: {os.environ.get('REDIS_PORT')}. Error: {e}")
         sys.exit(1)


    redis_conn = None
    pubsub = None
    backoff_time = 1 # Segundos

    while True:
        if redis_conn is None or pubsub is None:
            redis_conn = create_redis_connection(redis_host, redis_port, redis_password)
            if redis_conn:
                try:
                    pubsub = redis_conn.pubsub(ignore_subscribe_messages=True)
                    pubsub.subscribe(redis_channel)
                    print(f"Subscribed to Redis channel '{redis_channel}'. Waiting for messages...")
                    backoff_time = 1
                except Exception as e:
                    print(f"Error setting up pubsub/subscribing: {e}")
                    if redis_conn: redis_conn.close() # Intenta cerrar si la conexión se creó
                    redis_conn, pubsub = None, None # Marcar para reintentar conexión
            else:
                 print(f"Will retry Redis connection in {backoff_time} seconds...")
                 time.sleep(backoff_time)
                 backoff_time = min(backoff_time * 2, 60)
                 continue # Reintentar conexión

        # Intentar escuchar
        try:
            print("DEBUG: Entering pubsub.listen() loop...") # Log de depuración
            for item in pubsub.listen():
                print(f"Received raw item: {item}")
                if item['type'] == 'message':
                    try:
                        message_data = item['data'].decode("utf-8")
                        try:
                            message_content = json.loads(message_data)
                        except json.JSONDecodeError:
                            message_content = message_data

                        log_message(message_content)

                    except Exception as e:
                         print(f"Error processing received message: {e}. Raw data: {item.get('data')}")

            print("pubsub.listen() exited. Forcing reconnect.")
            if pubsub: pubsub.close()
            if redis_conn: redis_conn.close()
            redis_conn, pubsub = None, None

        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError, BrokenPipeError) as e: # Añadido BrokenPipeError
            print(f"Redis Error during listen ({type(e).__name__}): {e}. Attempting reconnect...")
            if pubsub:
                try: pubsub.close()
                except: pass # Ignorar errores al cerrar
            if redis_conn:
                try: redis_conn.close()
                except: pass # Ignorar errores al cerrar
            redis_conn, pubsub = None, None
            print(f"Will retry Redis connection in {backoff_time} seconds...")
            time.sleep(backoff_time)
            backoff_time = min(backoff_time * 2, 60)

        except Exception as e:
            print(f"Unexpected error during pubsub.listen loop ({type(e).__name__}): {e}")
            # Decide qué hacer, por ahora reconectar
            if pubsub:
                try: pubsub.close()
                except: pass
            if redis_conn:
                try: redis_conn.close()
                except: pass
            redis_conn, pubsub = None, None
            time.sleep(5)