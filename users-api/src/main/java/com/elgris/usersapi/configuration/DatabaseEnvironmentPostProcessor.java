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

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        // URL de conexión proporcionada

        Properties properts = new Properties();
        properts.put("jwt.secret", environment.getProperty("jwt.secret", ""));
        properts.put("server.port", environment.getProperty("server.port", ""));
        properts.put("spring.zipkin.baseUrl", environment.getProperty("spring.zipkin.baseUrl", ""));

        try {

            Class.forName("org.postgresql.Driver");

            Connection con = DriverManager.getConnection(
                    "jdbc:postgresql://ep-royal-snow-a8u3lgjs-pooler.eastus2.azure.neon.tech/neondb?sslmode=require",
                    "neondb_owner",
                    "npg_qs9gLMJPw4SI"
            );

            Statement stmt = con.createStatement();
            String sql = "SELECT name, value FROM env";
            ResultSet rs = stmt.executeQuery(sql);

            while (rs.next()) {
                String name = rs.getString("name");
                String value = rs.getString("value");

                // Agregar las propiedades a un mapa
                properts.put(name, value);

                switch (name) {
                    case "JWT_SECRET":
                        properts.put("jwt.secret", value);
                        break;
                
                    //case "USERS_API_PORT":
                      //  properts.put("server.port", value);
                        //break;

                    case "ZIPKIN_BASE_URL":
                        properts.put("spring.zipkin.baseUrl", value);
                        break;

                }
                
            }

            rs.close();
            stmt.close();
            con.close();

            System.out.println("Variables de entorno cargadas desde la base de datos:");
            System.out.println("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAa");

        } catch (Exception e) {
            throw new RuntimeException("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaFailed to fetch configuration from database", e);
        }

        PropertiesPropertySource propertySource = new PropertiesPropertySource("databaseProperties", properts);
        environment.getPropertySources().addFirst(propertySource);
       
    }
}