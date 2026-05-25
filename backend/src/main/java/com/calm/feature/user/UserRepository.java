package com.calm.feature.user;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
	Optional<User> findByEmail(String email);
	boolean existsByEmail(String email);
	Optional<User> findByRefreshToken(String refreshToken);

	/** Подписчики на погодные уведомления: задана локация + флаг включён. */
	@Query("{ 'notificationsEnabled': true, 'latitude': { $ne: null }, 'longitude': { $ne: null } }")
	List<User> findEligibleForForecastEmails();
}
