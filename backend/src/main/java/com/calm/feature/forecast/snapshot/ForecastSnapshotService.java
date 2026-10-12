package com.calm.feature.forecast.snapshot;

import com.calm.feature.forecast.dto.ForecastDayDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class ForecastSnapshotService {

	private static final Logger log = LoggerFactory.getLogger(ForecastSnapshotService.class);

	private final ForecastSnapshotRepository repo;

	public ForecastSnapshotService(ForecastSnapshotRepository repo) {
		this.repo = repo;
	}

	/**
	 * Сохраняет первый полученный прогноз для каждого дня и локации.
	 * Время создания позволяет отличать прогноз до начала дня от снимка в тот же день.
	 */
	public void saveForecastSnapshots(double lat, double lon, List<ForecastDayDto> days) {
		String key = ForecastSnapshot.makeLocationKey(lat, lon);
		for (ForecastDayDto day : days) saveIfMissing(key, day);
	}

	private void saveIfMissing(String key, ForecastDayDto day) {
		if (repo.findByLocationKeyAndDate(key, day.date()).isPresent()) return;

		ForecastSnapshot snap = new ForecastSnapshot();
		snap.setLocationKey(key);
		snap.setDate(day.date());
		snap.setRisk(day.risk());
		snap.setScore(day.score());
		snap.setPressureHpa(day.pressureHpa());
		snap.setPressureDelta24h(day.pressureDelta24h());
		snap.setHumidity(day.humidity());
		snap.setTempMin(day.tempMin());
		snap.setTempMax(day.tempMax());
		snap.setWindKmhMax(day.windKmhMax());
		snap.setKpIndex(day.kpIndex());
		snap.setTimezone(day.timezone());

		try {
			repo.save(snap);
			log.debug("Сохранён снимок прогноза: {} {} risk={}", key, day.date(), day.risk());
		} catch (DuplicateKeyException e) {
			// Race condition при параллельных запросах — не страшно, второй проиграл, данные уже есть.
		}
	}

	public List<ForecastSnapshot> findInRange(double lat, double lon, LocalDate from, LocalDate to) {
		return repo.findByLocationKeyAndDateBetween(
				ForecastSnapshot.makeLocationKey(lat, lon), from, to);
	}
}
