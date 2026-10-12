package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface SharedModelParticipationRepository extends MongoRepository<SharedModelParticipation, String> {
	Optional<SharedModelParticipation> findByUserId(String userId);
	long deleteByUserId(String userId);
}
