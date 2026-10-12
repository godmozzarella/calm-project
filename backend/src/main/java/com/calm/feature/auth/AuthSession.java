package com.calm.feature.auth;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

@Document(collection = "auth_sessions")
public class AuthSession {
	@Id
	private String id;
	@Indexed
	private String userId;
	@Indexed(unique = true)
	private String refreshToken;
	private Instant lastActivity;
	@Indexed(expireAfter = "0s")
	private Instant expiresAt;

	public AuthSession() {}

	public AuthSession(String userId, Instant now) {
		this.id = UUID.randomUUID().toString();
		this.userId = userId;
		this.refreshToken = UUID.randomUUID().toString();
		this.lastActivity = now;
		this.expiresAt = now.plusSeconds(30L * 24 * 3600);
	}

	public String getId() { return id; }
	public String getUserId() { return userId; }
	public String getRefreshToken() { return refreshToken; }
	public Instant getLastActivity() { return lastActivity; }
	public Instant getExpiresAt() { return expiresAt; }
}
