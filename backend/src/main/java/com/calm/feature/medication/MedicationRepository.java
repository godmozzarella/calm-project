package com.calm.feature.medication;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;

public interface MedicationRepository extends MongoRepository<Medication, String> {

	List<Medication> findByUserIdOrderByDateDescTimeDesc(String userId);

	List<Medication> findByUserIdAndDateBetweenOrderByDateAscTimeAsc(
			String userId, LocalDate from, LocalDate to
	);

	List<Medication> findByUserIdAndDate(String userId, LocalDate date);
}
