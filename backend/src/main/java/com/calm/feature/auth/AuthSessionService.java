package com.calm.feature.auth;

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class AuthSessionService {
	private static final Duration IDLE_LIMIT = Duration.ofMinutes(30);

	private final AuthSessionRepository repository;
	private final MongoTemplate mongoTemplate;

	public AuthSessionService(AuthSessionRepository repository, MongoTemplate mongoTemplate) {
		this.repository = repository;
		this.mongoTemplate = mongoTemplate;
	}

	public AuthSession create(String userId) {
		return repository.save(new AuthSession(userId, Instant.now()));
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
		Update update = new Update().set("lastActivity", now);
		return mongoTemplate.updateFirst(query, update, AuthSession.class).getMatchedCount() == 1;
	}

	/** Одноразовая ротация refresh-токена с той же проверкой неактивности. */
	public AuthSession refresh(String refreshToken) {
		Instant now = Instant.now();
		Query query = Query.query(Criteria.where("refreshToken").is(refreshToken)
				.and("lastActivity").gt(now.minus(IDLE_LIMIT))
				.and("expiresAt").gt(now));
		Update update = new Update()
				.set("refreshToken", UUID.randomUUID().toString())
				.set("expiresAt", now.plusSeconds(30L * 24 * 3600));
		return mongoTemplate.findAndModify(query, update,
				FindAndModifyOptions.options().returnNew(true), AuthSession.class);
	}

	public void revoke(String sessionId, String userId) {
		mongoTemplate.remove(Query.query(Criteria.where("_id").is(sessionId).and("userId").is(userId)),
				AuthSession.class);
	}
}
