package com.calm.feature.auth;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface AuthSessionRepository extends MongoRepository<AuthSession, String> {
	long deleteByUserId(String userId);
}
