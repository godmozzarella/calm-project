package com.calm.feature.attack;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface AttackRepository extends MongoRepository<Attack, String> {

	List<Attack> findByUserIdOrderByStartDateDescStartTimeDesc(String userId);
	boolean existsByUserIdAndStartDateBefore(String userId, LocalDate date);

	long deleteByUserId(String userId);
	List<Attack> findByOngoingTrue(Pageable page);

	@Aggregation(pipeline = {
			"{ $match: { createdAt: { $gte: ?0, $lt: ?1 } } }",
			"{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: ?2 } }, count: { $sum: 1 } } }",
			"{ $project: { _id: 0, date: '$_id', count: 1 } }"
	})
	List<DailyCount> countAddedByDay(Instant from, Instant until, String timezone);

	record DailyCount(String date, long count) {}

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
