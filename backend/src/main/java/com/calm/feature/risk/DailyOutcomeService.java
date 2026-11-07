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
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.context.ApplicationEventPublisher events;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private OnsetInputRepository onsetInputs;

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
        var attacks = attackRepository.findInRange(userId, date, date);
        boolean started = attacks.stream().anyMatch(a -> date.equals(a.getStartDate()));
        var mark = outcomeRepository.findByUserIdAndDate(userId, date).orElse(null);
        var status = started ? DailyOutcomeResponse.Status.ATTACK_STARTED
            : mark != null ? DailyOutcomeResponse.Status.NO_ATTACK_STARTED : DailyOutcomeResponse.Status.UNKNOWN;
        ZoneId zone = zoneFor(userId, date, mark == null ? "UTC" : mark.getTimezone());
        return new DailyOutcomeResponse(date, status, attacks.stream().anyMatch(a -> a.overlaps(date)),
            date.isBefore(LocalDate.now(zone)), DailyOutcome.NEW_START_DEFINITION);
    }

	public DailyOutcomeResponse confirmNoAttack(String userId, LocalDate date, String timezone) {
		if (date == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите дату");
        ZoneId zone = zoneFor(userId, date, timezone);
		if (date.isAfter(LocalDate.now(zone))) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Нельзя отмечать будущий день");
		}
		if (hasAttackStart(userId, date)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "На этот день уже записано начало нового приступа");
		}
		DailyOutcome outcome = outcomeRepository.findByUserIdAndDate(userId, date)
				.orElseGet(() -> DailyOutcome.noNewAttack(userId, date, Instant.now(), zone.getId()));
		outcome.remark(Instant.now(), zone.getId());
		outcomeRepository.save(outcome);
        // A parallel attack request may have cleared the mark before this save completed.
        if (hasAttackStart(userId, date)) {
            outcomeRepository.deleteByUserIdAndDate(userId, date);
            changed(userId);
            throw new ResponseStatusException(HttpStatus.CONFLICT, "На этот день уже записано начало нового приступа");
        }
        changed(userId);
        return get(userId, date);
	}

	public DailyOutcomeResponse clear(String userId, LocalDate date) {
		outcomeRepository.deleteByUserIdAndDate(userId, date);
        changed(userId);
		return get(userId, date);
	}

	private boolean hasAttackStart(String userId, LocalDate date) {
		return attackRepository.findInRange(userId, date, date).stream().anyMatch(a -> date.equals(a.getStartDate()));
	}

    private ZoneId zoneFor(String userId, LocalDate date, String fallback) {
        String timezone = onsetInputs == null ? null : onsetInputs.findById(OnsetInputSnapshot.key(userId, date))
            .filter(s -> !s.qualityFlags().contains("TIMEZONE_UNKNOWN"))
            .map(OnsetInputSnapshot::timezone).orElse(null);
        if (timezone == null) timezone = predictionRepository.findFirstByUserIdAndTargetDateOrderByIssuedAtDesc(userId, date)
            .map(RiskPredictionRecord::getTimezone).filter(value -> value != null && !value.isBlank()).orElse(fallback);
        try { return ZoneId.of(Objects.requireNonNullElse(timezone, "UTC")); }
        catch (RuntimeException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный часовой пояс"); }
    }

    private void changed(String userId) {
        if (events != null) events.publishEvent(new DiaryChangedEvent(userId));
    }
}
