package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyOutcomeRepository extends MongoRepository<DailyOutcome, String> {
	Optional<DailyOutcome> findByUserIdAndDate(String userId, LocalDate date);
	/** Both boundary dates belong to the requested interval. */
	@Query("{ 'userId': ?0, 'date': { $gte: ?1, $lte: ?2 } }")
	List<DailyOutcome> findByUserIdAndDateBetween(String userId, LocalDate from, LocalDate to);
	void deleteByUserIdAndDate(String userId, LocalDate date);
	long deleteByUserId(String userId);
}
