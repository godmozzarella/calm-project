package com.calm.feature.forecast.snapshot;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ForecastSnapshotRepository extends MongoRepository<ForecastSnapshot, String> {
	Optional<ForecastSnapshot> findByLocationKeyAndDate(String locationKey, LocalDate date);
	List<ForecastSnapshot> findByLocationKeyAndDateBetween(String locationKey, LocalDate from, LocalDate to);
}
