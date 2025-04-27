package com.elgris.usersapi.security;

import io.jsonwebtoken.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
// Eliminado: import org.springframework.security.core.Authentication; // No se usa directamente
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.List;
// Eliminado: import java.util.stream.Collectors; // No necesario para rol único


@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.toLowerCase().startsWith("bearer ")) {
            final String token = authHeader.substring(7);

            try {
                Claims claims = Jwts.parser()
                        .setSigningKey(jwtSecret.getBytes())
                        .parseClaimsJws(token)
                        .getBody();

                // ----- AJUSTE CRUCIAL AQUÍ -----
                // Leer el username desde el CLAIM "username", NO desde subject
                String username = claims.get("username", String.class); 
                log.debug("Attempting to extract username from 'username' claim: {}", username); // Log para verificar

                if (username != null) {

                    // ----- AJUSTE CRUCIAL AQUÍ -----
                    // Leer el rol desde el CLAIM "role" (singular, String)
                    String singleRole = claims.get("role", String.class);
                    log.debug("Attempting to extract role from 'role' claim: {}", singleRole); // Log para verificar

                    List<SimpleGrantedAuthority> authorities;
                    if (singleRole != null) {
                         // Crear autoridad basada en el rol único, con prefijo ROLE_
                         authorities = Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + singleRole.toUpperCase()));
                    } else {
                         log.warn("Role claim ('role') not found in token for user {}", username);
                         authorities = Collections.emptyList(); // Sin rol específico
                    }
                    log.debug("Authorities created: {}", authorities); // Log para verificar authorities


                    // Crear el objeto Authentication
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(username, null, authorities);

                    // Establecer la autenticación en el SecurityContext
                    log.debug("Attempting to set Authentication object: {}", authentication);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    log.debug("Authentication SET successfully for user: {}", username);

                    // Mantener por compatibilidad con tu controller actual
                    request.setAttribute("claims", claims);

                } else {
                     log.warn("Username could not be extracted from 'username' claim in token.");
                     SecurityContextHolder.clearContext();
                }

            } catch (ExpiredJwtException e) {
                log.warn("JWT token expired: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            } catch (UnsupportedJwtException | MalformedJwtException | SignatureException | IllegalArgumentException e) {
                log.warn("Invalid JWT token: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            } catch (Exception e) {
                log.error("Could not process JWT token - Unexpected error", e);
                SecurityContextHolder.clearContext();
            }
        } else {
            log.trace("No JWT Bearer token found in Authorization header, continuing chain.");
        }

        chain.doFilter(request, response);
    }
}