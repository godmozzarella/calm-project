package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface RiskTrainingInputSnapshotRepository extends MongoRepository<RiskTrainingInputSnapshot, String> {
	Optional<RiskTrainingInputSnapshot> findByUserIdAndTargetDate(String userId, LocalDate targetDate);
	long deleteByUserId(String userId);
}
