package com.calm.feature.medication;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PersonalMedicationRepository extends MongoRepository<PersonalMedication, String> {
	List<PersonalMedication> findByUserIdOrderByNameAsc(String userId);
	Optional<PersonalMedication> findByUserIdAndNormalizedName(String userId, String normalizedName);
	Optional<PersonalMedication> findByIdAndUserId(String id, String userId);
	long deleteByUserId(String userId);
}
