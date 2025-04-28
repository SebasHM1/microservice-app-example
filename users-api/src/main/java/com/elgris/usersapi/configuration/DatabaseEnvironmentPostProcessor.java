package com.elgris.usersapi.configuration;

import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.boot.SpringApplication;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Properties;

@Component
public class DatabaseEnvironmentPostProcessor implements EnvironmentPostProcessor {

    // Define la clave de la propiedad del puerto de forma consistente
    private static final String SERVER_PORT_PROPERTY = "server.port";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {

        Properties dbProperties = new Properties();
        String portFromDb = null; // Variable para almacenar el puerto si viene de la DB

        try {
            // --- Carga desde la Base de Datos ---
            System.out.println("Connecting to DB for environment properties...");
            Class.forName("org.postgresql.Driver");
            Connection con = DriverManager.getConnection(
                    "jdbc:postgresql://ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
                    "neondb_owner",
                    "npg_qs9gLMJPw4SI" // ¡Considera mover esto a variables de entorno también!
            );

            Statement stmt = con.createStatement();
            String sql = "SELECT name, value FROM env";
            ResultSet rs = stmt.executeQuery(sql);

            System.out.println("Loading properties from database...");
            while (rs.next()) {
                String name = rs.getString("name");
                String value = rs.getString("value");

                // Guarda TODAS las propiedades leídas de la DB
                dbProperties.put(name, value);
                System.out.println("  Loaded from DB: " + name + "=" + value);

                // Guarda específicamente el valor del puerto si lo encuentras
                if ("USERS_API_PORT".equals(name)) {
                     portFromDb = value;
                }

                // --- Mapeos específicos (MANTENLOS ACTUALIZADOS) ---
                // Ya no necesitas el switch si mapeas directo o usas el nombre de la DB
                if ("JWT_SECRET".equals(name)) {
                    dbProperties.put("jwt.secret", value);
                }
                 if ("ZIPKIN_BASE_URL".equals(name)) { // Asegúrate que la clave en la DB sea esta
                     dbProperties.put("spring.zipkin.baseUrl", value);
                 }
                 // Añade otros mapeos si son necesarios (ej. spring.datasource.url, etc.)
            }

            rs.close();
            stmt.close();
            con.close();
            System.out.println("Finished loading from database.");

        } catch (Exception e) {
            // Loguea el error pero no detengas el arranque, quizás pueda funcionar con otras fuentes
            System.err.println("WARNING: Failed to fetch configuration from database. Application might use defaults or other sources. Error: " + e.getMessage());
            // Opcional: relanzar si la configuración de DB es absolutamente crítica
            // throw new RuntimeException("Failed to fetch configuration from database", e);
        }

        // --- LÓGICA DE PRIORIDAD DEL PUERTO ---
        System.out.println("Determining final server port...");
        String portToUse = null;
        String railwayPort = environment.getProperty("PORT"); // Intenta leer PORT del entorno

        if (railwayPort != null && !railwayPort.isEmpty()) {
            // 1. Prioridad: Variable de entorno PORT (Railway)
            portToUse = railwayPort;
            System.out.println("Using PORT from environment variable: " + portToUse);
        } else if (portFromDb != null && !portFromDb.isEmpty()) {
            // 2. Prioridad: USERS_API_PORT desde la base de datos
            // (Esto solo se usa si comentaste la línea original que lo usaba)
            // ¡Si descomentaste esa línea, este bloque es redundante!
            portToUse = portFromDb;
            System.out.println("Using USERS_API_PORT from database: " + portToUse);
        } else {
             // 3. Fallback: Intenta leer server.port de application.properties (o su default)
             // Esto podría coger el ':8080' si PORT no estaba definido
             portToUse = environment.getProperty(SERVER_PORT_PROPERTY);
             System.out.println("Using server.port from other sources (e.g., application.properties fallback): " + portToUse);
             // Si incluso eso falla, podrías forzar un default aquí, pero ${PORT:8080} debería haber funcionado
             // if (portToUse == null || portToUse.isEmpty()) {
             //    portToUse = "8080"; // Último recurso
             // }
        }

        // Asegúrate de que el puerto final se establezca en las propiedades que se añadirán
        if (portToUse != null && !portToUse.isEmpty()) {
             System.out.println("Setting final " + SERVER_PORT_PROPERTY + " to: " + portToUse);
             dbProperties.put(SERVER_PORT_PROPERTY, portToUse); // ¡SOBRESCRIBE explícitamente!
        } else {
             System.err.println("WARNING: Could not determine a valid server port!");
        }
        // --- FIN LÓGICA DE PRIORIDAD DEL PUERTO ---


        // Añade las propiedades (incluyendo el server.port decidido) con alta prioridad
        PropertiesPropertySource propertySource = new PropertiesPropertySource("databaseProperties", dbProperties);
        environment.getPropertySources().addFirst(propertySource); // Añade al PRINCIPIO (máxima prioridad)
        System.out.println("Database properties added to environment with highest priority.");
    }
}