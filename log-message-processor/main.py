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


if __name__ == '__main__':

    print("Starting log-message-processor...") # Log inicial
    load_env_variables_from_db() # Carga la configuración primero

    # Accede a las variables DESPUÉS de que load_env_variables_from_db() las haya cargado
    try:
        redis_host = os.environ['REDIS_HOST']
        redis_port = int(os.environ['REDIS_PORT'])
        redis_channel = os.environ['REDIS_CHANNEL']
        redis_password = os.environ.get('REDIS_PASSWORD') # Usa get por si no está definida
        # zipkin_url = os.environ.get('ZIPKIN_URL', '') # Usa get con default si Zipkin es opcional
    except KeyError as e:
        print(f"Error: Missing required environment variable from database or Railway: {e}")
        sys.exit(1)

    print(f"Connecting to Redis: {redis_host}:{redis_port} on channel '{redis_channel}'") # Log

    # Considera quitar toda la lógica de transporte de Zipkin si ya no se usa
    # def http_transport(encoded_span):
    #    # ...

    # Conexión a Redis
    try:
        r = redis.Redis(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            ssl=True, # Asegúrate que tu Redis (Upstash?) requiera SSL
            ssl_cert_reqs=None, # Puede ser necesario para algunos proveedores de SSL
            db=0,
            socket_connect_timeout=5, # Añade timeout
            socket_timeout=5
        )
        r.ping() # Prueba la conexión
        print("Redis connection successful (ping).")
        pubsub = r.pubsub(ignore_subscribe_messages=True) # Ignora mensajes automáticos
        pubsub.subscribe(redis_channel)
        print(f"Subscribed to Redis channel '{redis_channel}'. Waiting for messages...")
    except redis.exceptions.ConnectionError as e:
        print(f"Fatal: Could not connect to Redis at {redis_host}:{redis_port}. Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Fatal: An unexpected error occurred during Redis setup: {e}")
        sys.exit(1)


    # Bucle principal para escuchar mensajes
    for item in pubsub.listen():
        # El item ya no debería ser el mensaje de subscripción por ignore_subscribe_messages=True
        # Pero añadimos una comprobación por si acaso
        if item['type'] == 'message':
            try:
                # Decodifica el mensaje
                message_data = item['data'].decode("utf-8")
                # Intenta parsear como JSON, si falla, trátalo como texto plano
                try:
                    message_content = json.loads(message_data)
                except json.JSONDecodeError:
                    message_content = message_data # No era JSON, usa el texto tal cual

                # --- Lógica de Zipkin (Considera eliminarla si no la usas) ---
                # zipkin_enabled = bool(zipkin_url) and isinstance(message_content, dict) and 'zipkinSpan' in message_content
                # if zipkin_enabled:
                #     span_data = message_content['zipkinSpan']
                #     try:
                #         with zipkin_span( # ... configuración de zipkin ... ):
                #              log_message(message_content)
                #     except Exception as ze:
                #         print(f'Zipkin error: {ze}')
                #         log_message(message_content) # Loguea igualmente si Zipkin falla
                # else:
                #     # Log sin Zipkin
                #     log_message(message_content)
                # --- Fin Lógica Zipkin ---

                # --- Log simple (si quitaste Zipkin) ---
                log_message(message_content)
                # --------------------------------------

            except Exception as e:
                # Error procesando el mensaje (decoding, json parsing, etc.)
                print(f"Error processing received item: {e}. Raw item: {item}")
                # Decide si continuar o no dependiendo del error
                # continue