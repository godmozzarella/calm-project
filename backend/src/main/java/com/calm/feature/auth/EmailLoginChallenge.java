package com.calm.feature.auth;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("email_login_challenges")
public record EmailLoginChallenge(
		@Id String email,
		@Indexed String tokenHash,
		String codeHash,
		Instant sentAt,
		@Indexed(expireAfter = "0s") Instant expiresAt,
		int attempts,
		boolean used
) {}
