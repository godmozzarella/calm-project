package com.calm.feature.user;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    @Query("{'_id': ?0}")
    @org.springframework.data.mongodb.repository.Update("{'$set': {'role': ?1}}")
    long updateRole(String id, Role role);

    @Query("{'_id': ?0}")
    @org.springframework.data.mongodb.repository.Update("{'$set': {'lastNotifiedDate': ?1}}")
    void markNotified(String id, java.time.LocalDate day);

	Optional<User> findByEmail(String email);
	boolean existsByEmail(String email);
	Optional<User> findByRefreshToken(String refreshToken);

	/** Подписчики на погодные уведомления: задана локация + флаг включён. */
	@Query("{ 'emailVerified': true, 'notificationsEnabled': true, 'latitude': { $ne: null }, 'longitude': { $ne: null } }")
	List<User> findEligibleForForecastEmails(Pageable page);
	long countByEmailVerifiedTrueAndNotificationsEnabledTrue();
	List<User> findByEmailVerifiedTrueAndNotificationsEnabledTrue(Sort sort);
}
