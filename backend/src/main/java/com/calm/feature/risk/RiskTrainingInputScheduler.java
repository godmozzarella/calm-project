package com.calm.feature.risk;

import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/** Забирает завтрашние входы для участников без посещения страницы прогноза. */
@Component
public class RiskTrainingInputScheduler {
	private static final Logger log = LoggerFactory.getLogger(RiskTrainingInputScheduler.class);
	private final SharedModelParticipationRepository participations;
	private final UserRepository users;
	private final ForecastService forecast;
	private final RiskPredictionService risk;
	private final RiskTrainingInputSnapshotRepository snapshots;

	public RiskTrainingInputScheduler(SharedModelParticipationRepository participations, UserRepository users,
			ForecastService forecast, RiskPredictionService risk, RiskTrainingInputSnapshotRepository snapshots) {
		this.participations = participations;
		this.users = users;
		this.forecast = forecast;
		this.risk = risk;
		this.snapshots = snapshots;
	}

	@Scheduled(fixedDelayString = "${calm.risk-pilot.capture-delay-ms:21600000}",
			initialDelayString = "${calm.risk-pilot.capture-initial-delay-ms:60000}")
	public void captureUpcomingDays() {
		int captured = 0;
		int errors = 0;
		for (SharedModelParticipation participation : participations.findAll()) {
			if (!participation.isParticipating() || participation.isAdminBlocked()
					|| !SharedModelConsentPolicy.VERSION.equals(participation.getConsentVersion())
					|| !SharedModelConsentPolicy.DIGEST.equals(participation.getConsentDigest())) continue;
			User user = users.findById(participation.getUserId()).orElse(null);
			if (user == null || user.getLatitude() == null || user.getLongitude() == null) continue;
			try {
				for (ForecastDayDto day : forecast.getForecast(user.getLatitude(), user.getLongitude()).days()) {
					if (day.timezone() == null || !day.date().equals(LocalDate.now(ZoneId.of(day.timezone())).plusDays(1))) continue;
					if (snapshots.findByUserIdAndTargetDate(user.getId(), day.date())
							.filter(snapshot -> snapshot.getFeatureSchemaVersion() >= 3).isPresent()) continue;
					risk.captureTrainingInput(user.getId(), day.date());
					captured++;
				}
			} catch (RuntimeException e) {
				errors++;
				log.warn("Сбор входов для модели пропущен: {}", e.getMessage());
			}
		}
		log.info("Сбор входов для модели: попыток={}, ошибок={}", captured, errors);
	}
}
