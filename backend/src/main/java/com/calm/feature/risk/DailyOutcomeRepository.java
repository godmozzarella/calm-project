package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyOutcomeRepository extends MongoRepository<DailyOutcome, String> {
	Optional<DailyOutcome> findByUserIdAndDate(String userId, LocalDate date);
	List<DailyOutcome> findByUserIdAndDateBetween(String userId, LocalDate from, LocalDate to);
	void deleteByUserIdAndDate(String userId, LocalDate date);
	long deleteByUserId(String userId);
}
