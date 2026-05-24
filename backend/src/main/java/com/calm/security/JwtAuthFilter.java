package com.calm.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

	private static final String BEARER_PREFIX = "Bearer ";

	private final JwtService jwtService;

	public JwtAuthFilter(JwtService jwtService) {
		this.jwtService = jwtService;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
			throws ServletException, IOException {

		String header = req.getHeader("Authorization");
		if (header == null || !header.startsWith(BEARER_PREFIX)) {
			chain.doFilter(req, res);
			return;
		}

		String token = header.substring(BEARER_PREFIX.length());
		try {
			Claims claims = jwtService.parse(token);
			String userId = claims.getSubject();
			String email = claims.get("email", String.class);

			AuthenticatedUser principal = new AuthenticatedUser(userId, email);
			UsernamePasswordAuthenticationToken auth =
					new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
			auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
			SecurityContextHolder.getContext().setAuthentication(auth);
		} catch (JwtException e) {
			// Невалидный токен — оставляем неаутентифицированным, дальше отдадут 401
			SecurityContextHolder.clearContext();
		}

		chain.doFilter(req, res);
	}
}
