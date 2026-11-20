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
	private String loginEmail;
	private Instant lastActivity;
	@Indexed(expireAfter = "0s")
	private Instant expiresAt;

	public AuthSession() {}

	public AuthSession(String userId, String email, String hash, Instant now) {
		this.id = UUID.randomUUID().toString();
		this.userId = userId;
		this.refreshToken = hash;
		this.loginEmail = email;
		this.lastActivity = now;
		this.expiresAt = now.plus(AuthSessionService.IDLE_LIMIT);
	}

	public String getLoginEmail() { return loginEmail; }

	public String getId() { return id; }
	public String getUserId() { return userId; }
	public String getRefreshToken() { return refreshToken; }
	public Instant getLastActivity() { return lastActivity; }
	public Instant getExpiresAt() { return expiresAt; }
}
