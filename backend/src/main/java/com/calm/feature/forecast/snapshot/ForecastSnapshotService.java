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
	 * Сохраняет снимок прогноза на «сегодня» (первый день из ответа) — если ещё нет.
	 * Идемпотентно: повторный вызов в тот же день для тех же координат ничего не делает.
	 */
	public void saveTodaySnapshot(double lat, double lon, List<ForecastDayDto> days) {
		if (days.isEmpty()) return;
		ForecastDayDto today = days.get(0);
		String key = ForecastSnapshot.makeLocationKey(lat, lon);

		if (repo.findByLocationKeyAndDate(key, today.date()).isPresent()) return;

		ForecastSnapshot snap = new ForecastSnapshot();
		snap.setLocationKey(key);
		snap.setDate(today.date());
		snap.setRisk(today.risk());
		snap.setScore(today.score());
		snap.setPressureHpa(today.pressureHpa());
		snap.setPressureDelta24h(today.pressureDelta24h());
		snap.setHumidity(today.humidity());
		snap.setTempMin(today.tempMin());
		snap.setTempMax(today.tempMax());
		snap.setWindKmhMax(today.windKmhMax());
		snap.setKpIndex(today.kpIndex());

		try {
			repo.save(snap);
			log.debug("Сохранён снимок прогноза: {} {} risk={}", key, today.date(), today.risk());
		} catch (DuplicateKeyException e) {
			// Race condition при параллельных запросах — не страшно, второй проиграл, данные уже есть.
		}
	}

	public List<ForecastSnapshot> findInRange(double lat, double lon, LocalDate from, LocalDate to) {
		return repo.findByLocationKeyAndDateBetween(
				ForecastSnapshot.makeLocationKey(lat, lon), from, to);
	}
}
