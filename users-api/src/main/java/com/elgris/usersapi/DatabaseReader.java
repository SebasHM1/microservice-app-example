package com.elgris.usersapi;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class DatabaseReader implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        // Consulta SQL para obtener las variables de entorno desde la base de datos
        String sql = "SELECT name, value FROM records";

        // Ejecutar la consulta y procesar los resultados
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);

        for (Map<String, Object> row : rows) {
            String name = (String) row.get("name");
            String value = (String) row.get("value");

            // Sobrescribir las propiedades de Spring Boot
            System.setProperty(name, value);
            System.out.println("Variable de entorno actualizada: " + name + " = " + value);
        }
    }
}