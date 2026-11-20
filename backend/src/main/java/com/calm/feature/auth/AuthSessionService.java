package com.calm.feature.auth;

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class AuthSessionService {
	static final Duration IDLE_LIMIT = Duration.ofDays(30);

	private final AuthSessionRepository repository;
	private final MongoTemplate mongoTemplate;

	public AuthSessionService(AuthSessionRepository repository, MongoTemplate mongoTemplate) {
		this.repository = repository;
		this.mongoTemplate = mongoTemplate;
	}

	/** Обычные запросы проверяют сессию, но сами по себе не продлевают неактивность. */
	public boolean isActive(String sessionId, String userId) {
		Instant now = Instant.now();
		return mongoTemplate.exists(Query.query(Criteria.where("_id").is(sessionId)
				.and("userId").is(userId)
				.and("lastActivity").gt(now.minus(IDLE_LIMIT))
				.and("expiresAt").gt(now)), AuthSession.class);
	}

	/** Атомарная проверка и отметка действия: просроченную сессию нельзя оживить запросом. */
	public boolean touch(String sessionId, String userId) {
		Instant now = Instant.now();
		Query query = Query.query(Criteria.where("_id").is(sessionId)
				.and("userId").is(userId)
				.and("lastActivity").gt(now.minus(IDLE_LIMIT))
				.and("expiresAt").gt(now));
		Update update = new Update().max("lastActivity", now).max("expiresAt", now.plus(IDLE_LIMIT));
		return mongoTemplate.updateFirst(query, update, AuthSession.class).getMatchedCount() == 1;
	}

	/** Одноразовая ротация refresh-токена с той же проверкой неактивности. */
	public AuthSession migrate(String refreshToken, String cookieToken) {
		Instant now = Instant.now();
		Query query = Query.query(Criteria.where("refreshToken").is(refreshToken)
				.and("lastActivity").gt(now.minus(IDLE_LIMIT))
				.and("expiresAt").gt(now));
		Update update = new Update()
				.set("refreshToken", storedSecret(cookieToken));
		return mongoTemplate.findAndModify(query, update,
				FindAndModifyOptions.options().returnNew(true), AuthSession.class);
	}

	public AuthSession findCookieSession(String token) {
		Instant now = Instant.now();
		return mongoTemplate.findOne(Query.query(Criteria.where("refreshToken").is(storedSecret(token))
				.and("lastActivity").gt(now.minus(IDLE_LIMIT)).and("expiresAt").gt(now)), AuthSession.class);
	}

	public AuthSession createCookieSession(String userId, String email, String token) {
		AuthSession session = new AuthSession(userId, email, storedSecret(token), Instant.now());
		return repository.insert(session);
	}

	public static boolean validCookie(String token) {
		return token != null && token.matches("[A-Za-z0-9_-]{43}");
	}

	private static String storedSecret(String token) {
		try {
			byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
					.digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
			return "sha256:" + java.util.HexFormat.of().formatHex(digest);
		} catch (java.security.NoSuchAlgorithmException e) {
			throw new IllegalStateException("SHA-256 unavailable", e);
		}
	}

	public void revoke(String sessionId, String userId) {
		mongoTemplate.remove(Query.query(Criteria.where("_id").is(sessionId).and("userId").is(userId)),
				AuthSession.class);
	}
}
