package com.calm.feature.attack;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface AttackRepository extends MongoRepository<Attack, String> {

	List<Attack> findByUserIdOrderByStartDateDescStartTimeDesc(String userId);
	boolean existsByUserIdAndStartDate(String userId, LocalDate date);

	long deleteByUserId(String userId);

	/**
	 * Все приступы пользователя, чей диапазон пересекает [from, to].
	 * A missing end date on an old non-ongoing entry covers its start day only.
	 */
	@Query("""
			{ 'userId': ?0,
			  'startDate': { $lte: ?2 },
			  $or: [ { 'endDate': { $gte: ?1 } }, { 'ongoing': true },
			         { 'startDate': { $gte: ?1 } } ]
			}""")
	List<Attack> findInRange(String userId, LocalDate from, LocalDate to);
}
