package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RiskPredictionRecordRepository extends MongoRepository<RiskPredictionRecord, String> {
	@Query("{ 'userId': ?0, 'targetDate': { $gte: ?1, $lte: ?2 } }")
	List<RiskPredictionRecord> findForEvaluation(String userId, LocalDate from, LocalDate to);

	Optional<RiskPredictionRecord> findFirstByUserIdAndTargetDateOrderByIssuedAtDesc(String userId, LocalDate targetDate);

	long deleteByUserId(String userId);
}
