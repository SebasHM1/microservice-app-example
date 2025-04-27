package com.elgris.usersapi.api; // O el paquete que corresponda

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController // <--- Nota que NO hay @RequestMapping aquí
public class RootController {

    @GetMapping("/") // <--- Este SÍ mapea a la ruta raíz GET /
    public String root() {
        return "Users API is running"; 
    }

    // Podrías incluso añadir un endpoint /health si quieres ser más explícito
    @GetMapping("/health")
    public String healthCheck() {
        return "{\"status\":\"UP\"}"; // Formato común para health checks
    }
}