package com.calm.feature.forecast.snapshot;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ForecastSnapshotRepository extends MongoRepository<ForecastSnapshot, String> {
	Optional<ForecastSnapshot> findByLocationKeyAndDate(String locationKey, LocalDate date);
	@Query("{ 'locationKey': ?0, 'date': { $gte: ?1, $lte: ?2 } }")
	List<ForecastSnapshot> findByLocationKeyAndDateBetween(String locationKey, LocalDate from, LocalDate to);
}
