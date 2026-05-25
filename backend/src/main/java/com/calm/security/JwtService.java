package com.calm.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;

@Service
public class JwtService {

	private final SecretKey key;
	private final Duration ttl;

	public JwtService(
			@Value("${calm.jwt.secret}") String secret,
			@Value("${calm.jwt.expiration-minutes}") long expirationMinutes
	) {
		byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
		if (bytes.length < 32) {
			throw new IllegalStateException("CALM_JWT_SECRET must be at least 32 bytes");
		}
		this.key = Keys.hmacShaKeyFor(bytes);
		this.ttl = Duration.ofMinutes(expirationMinutes);
	}

	public String issue(String userId, String email, String role) {
		Date now = new Date();
		return Jwts.builder()
				.subject(userId)
				.claim("email", email)
				.claim("role", role)
				.issuedAt(now)
				.expiration(new Date(now.getTime() + ttl.toMillis()))
				.signWith(key)
				.compact();
	}

	public Claims parse(String token) {
		return Jwts.parser()
				.verifyWith(key)
				.build()
				.parseSignedClaims(token)
				.getPayload();
	}
}
