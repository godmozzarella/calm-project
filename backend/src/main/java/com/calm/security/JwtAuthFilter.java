package com.calm.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import com.calm.feature.auth.AuthSessionService;
import com.calm.feature.user.Role;
import com.calm.feature.user.UserRepository;
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
	private final AuthSessionService sessionService;
	private final UserRepository users;

	public JwtAuthFilter(JwtService jwtService, AuthSessionService sessionService, UserRepository users) {
		this.jwtService = jwtService;
		this.sessionService = sessionService;
		this.users = users;
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
			String role = claims.get("role", String.class);
			String sessionId = claims.get("sessionId", String.class);
			if (sessionId == null || !sessionService.isActive(sessionId, userId)) {
				SecurityContextHolder.clearContext();
				chain.doFilter(req, res);
				return;
			}
			// Admin rights can be revoked while an access token is still valid.
			// Confirm the current database role before granting an admin request.
			if ("ADMIN".equals(role) && users.findById(userId)
					.map(user -> user.getRole() != Role.ADMIN).orElse(true)) {
				SecurityContextHolder.clearContext();
				chain.doFilter(req, res);
				return;
			}

			AuthenticatedUser principal = new AuthenticatedUser(userId, email, role, sessionId);
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
