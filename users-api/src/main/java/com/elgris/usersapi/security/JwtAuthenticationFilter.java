package com.elgris.usersapi.security;

import io.jsonwebtoken.*; // Importar más excepciones
import org.slf4j.Logger;   // Usar slf4j para logging
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter; // Usar OncePerRequestFilter es más estándar

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections; // Para autoridades simples
import java.util.List;
import java.util.stream.Collectors;


@Component
// Es mejor usar OncePerRequestFilter para asegurar que se ejecuta una sola vez por request
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization"); // Nombre de header estándar

        // 1. Intentar procesar solo si existe la cabecera Bearer
        if (authHeader != null && authHeader.toLowerCase().startsWith("bearer ")) {
            final String token = authHeader.substring(7);

            try {
                // 2. Validar el token y obtener claims
                Claims claims = Jwts.parser()
                        .setSigningKey(jwtSecret.getBytes())
                        .parseClaimsJws(token)
                        .getBody();

                // 3. Crear el objeto Authentication para Spring Security
                String username = claims.getSubject(); // Convención: username en el subject
                // Opcionalmente: String username = claims.get("username", String.class); si usaste ese claim

                if (username != null) {
                    // Extraer roles/authorities si existen en el token (ej: claim "role")
                    // AJUSTA ESTO según cómo guardes los roles en tu token
                    @SuppressWarnings("unchecked") // Necesario si el claim es una lista/string
                    List<String> roles = claims.get("roles", List.class); // Ejemplo si guardas una lista de roles
                    String singleRole = claims.get("role", String.class); // Ejemplo si guardas un solo rol

                    List<SimpleGrantedAuthority> authorities;
                    if (roles != null) {
                         authorities = roles.stream()
                                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                                .collect(Collectors.toList());
                    } else if (singleRole != null) {
                         authorities = Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + singleRole.toUpperCase()));
                    } else {
                         authorities = Collections.emptyList(); // O un rol por defecto si prefieres
                    }


                    // Crear el objeto Authentication (principal=username, credentials=null, authorities)
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(username, null, authorities);

                    // 4. Establecer la autenticación en el SecurityContext DE SPRING
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    log.debug("User '{}' authenticated successfully via JWT with authorities: {}", username, authorities);

                    // 5. (Opcional, para compatibilidad con tu controller actual) Poner claims en el request
                     request.setAttribute("claims", claims);

                } else {
                     log.warn("JWT token does not contain username (subject)");
                     SecurityContextHolder.clearContext(); // Limpiar por si acaso
                }

            // 6. Manejar excepciones de JWT de forma más específica y SIN lanzar ServletException
            } catch (ExpiredJwtException e) {
                log.warn("JWT token expired: {}", e.getMessage());
                SecurityContextHolder.clearContext(); // Limpiar contexto
                // Podrías establecer un atributo de error en el request o enviar un 401 directamente si quieres
                // response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token expired"); return; // Ejemplo
            } catch (UnsupportedJwtException | MalformedJwtException | SignatureException | IllegalArgumentException e) {
                log.warn("Invalid JWT token: {}", e.getMessage()); // Unifica errores de formato/firma/etc.
                SecurityContextHolder.clearContext(); // Limpiar contexto
            } catch (Exception e) {
                log.error("Could not process JWT token - Unexpected error", e);
                SecurityContextHolder.clearContext(); // Limpiar contexto en caso de error inesperado
            }
        } else {
            // Si no hay header "Authorization: Bearer ..." simplemente no hacemos nada aquí.
            // El usuario permanecerá anónimo para Spring Security.
            log.trace("No JWT Bearer token found in Authorization header, continuing chain.");
        }

        // 7. **SIEMPRE** continuar la cadena de filtros.
        // Si el token era válido, el SecurityContext está poblado.
        // Si no había token o era inválido, el SecurityContext está vacío (o limpiado).
        // FilterSecurityInterceptor decidirá más adelante si permite o deniega el acceso basado en el contexto y las reglas de HttpSecurity.
        chain.doFilter(request, response);
    }
}