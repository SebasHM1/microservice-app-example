package com.elgris.usersapi.configuration;

import com.elgris.usersapi.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

@EnableWebSecurity
@EnableGlobalMethodSecurity(securedEnabled = true)
class HttpSecurityConfiguration {

    @Configuration
    public static class ApiConfigurerAdatper extends WebSecurityConfigurerAdapter {

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            // (Opcional pero recomendado para APIs stateless) Deshabilita CSRF
            .csrf().disable() 
            
            // Configura CORS si es necesario a nivel de Spring Security
            // .cors().and() // Necesitarías un bean CorsConfigurationSource

            // Define las reglas de autorización ANTES de añadir el filtro
            .authorizeRequests()
                // Permite acceso sin autenticación a la raíz y /health
                .antMatchers("/", "/health").permitAll() 
                // Cualquier otra petición requiere autenticación
                .anyRequest().authenticated()
            .and() // Vuelve a la configuración principal de HttpSecurity

            // AÑADE el filtro JWT DESPUÉS de configurar las autorizaciones
            // Se aplicará solo a las rutas que requieren autenticación (anyRequest().authenticated())
            .addFilterAfter(jwtAuthenticationFilter, BasicAuthenticationFilter.class); 
    }
}
}
