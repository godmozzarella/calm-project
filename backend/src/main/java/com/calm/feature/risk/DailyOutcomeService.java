package com.calm.feature.risk;

import com.calm.feature.attack.AttackRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

@Service
public class DailyOutcomeService {
	private final DailyOutcomeRepository outcomeRepository;
	private final AttackRepository attackRepository;
	private final RiskPredictionRecordRepository predictionRepository;

	public DailyOutcomeService(DailyOutcomeRepository outcomeRepository, AttackRepository attackRepository,
			RiskPredictionRecordRepository predictionRepository) {
		this.outcomeRepository = outcomeRepository;
		this.attackRepository = attackRepository;
		this.predictionRepository = predictionRepository;
	}

	public DailyOutcomeResponse get(String userId, LocalDate date) {
		if (hasAttack(userId, date)) {
			return new DailyOutcomeResponse(date, DailyOutcomeResponse.Status.ATTACK_PRESENT);
		}
		return new DailyOutcomeResponse(date, outcomeRepository.findByUserIdAndDate(userId, date).isPresent()
				? DailyOutcomeResponse.Status.NO_ATTACK
				: DailyOutcomeResponse.Status.UNKNOWN);
	}

	public DailyOutcomeResponse confirmNoAttack(String userId, LocalDate date, String timezone) {
		ZoneId zone;
		String forecastTimezone = predictionRepository
				.findFirstByUserIdAndTargetDateOrderByIssuedAtDesc(userId, date)
				.map(RiskPredictionRecord::getTimezone)
				.filter(value -> value != null && !value.isBlank())
				.orElse(timezone);
		try { zone = ZoneId.of(Objects.requireNonNullElse(forecastTimezone, "UTC")); }
		catch (RuntimeException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный часовой пояс"); }
		if (date.isAfter(LocalDate.now(zone))) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Нельзя отмечать будущий день");
		}
		if (hasAttack(userId, date)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "На этот день уже записан приступ");
		}
		DailyOutcome outcome = outcomeRepository.findByUserIdAndDate(userId, date)
				.orElseGet(() -> new DailyOutcome(userId, date, Instant.now()));
		outcomeRepository.save(outcome);
		return new DailyOutcomeResponse(date, DailyOutcomeResponse.Status.NO_ATTACK);
	}

	public DailyOutcomeResponse clear(String userId, LocalDate date) {
		outcomeRepository.deleteByUserIdAndDate(userId, date);
		return get(userId, date);
	}

	private boolean hasAttack(String userId, LocalDate date) {
		return attackRepository.findInRange(userId, date, date).stream().anyMatch(a -> a.overlaps(date));
	}
}
