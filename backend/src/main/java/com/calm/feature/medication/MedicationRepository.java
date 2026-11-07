package com.calm.feature.medication;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public interface MedicationRepository extends MongoRepository<Medication, String> {

	List<Medication> findByUserIdOrderByDateDescTimeDesc(String userId);

	@Query(value = "{ 'userId': ?0, 'personalMedicationId': { $in: ?1 } }",
	       sort = "{ 'date': 1, 'time': 1 }")
	List<Medication> findPersonalHistoryForDefaults(String userId, Set<String> personalIds);

	@Query("{ 'userId': ?0, 'category': 'Другое', 'personalMedicationId': null }")
	List<Medication> findLegacyPersonal(String userId);

	long deleteByUserId(String userId);

	@Query(value  = "{ 'userId': ?0, 'date': { $gte: ?1, $lte: ?2 } }",
	       sort   = "{ 'date': 1, 'time': 1 }")
	List<Medication> findInRange(String userId, LocalDate from, LocalDate to);
}
