package com.calm.feature.attack;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface AttackRepository extends MongoRepository<Attack, String> {

	List<Attack> findByUserIdOrderByStartDateDescStartTimeDesc(String userId);

	/**
	 * Все приступы пользователя, чей диапазон пересекает [from, to].
	 * ongoing = true считается «продолжается до сегодня», поэтому условие fuzzy:
	 * either endDate >= from OR ongoing = true.
	 */
	@Query("""
			{ 'userId': ?0,
			  'startDate': { $lte: ?2 },
			  $or: [ { 'endDate': { $gte: ?1 } }, { 'ongoing': true } ]
			}""")
	List<Attack> findInRange(String userId, LocalDate from, LocalDate to);
}
