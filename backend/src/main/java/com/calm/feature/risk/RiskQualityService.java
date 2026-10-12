package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RiskQualityService {
	private static final int WINDOW_DAYS = 90;
	private static final int ALERT_THRESHOLD = 35;
	private static final int MIN_DAYS = 30;
	private static final int MIN_ATTACK_DAYS = 5;

	private final RiskPredictionRecordRepository predictionRepo;
	private final AttackRepository attackRepo;
	private final DailyOutcomeRepository outcomeRepo;

	public RiskQualityService(RiskPredictionRecordRepository predictionRepo, AttackRepository attackRepo,
			DailyOutcomeRepository outcomeRepo) {
		this.predictionRepo = predictionRepo;
		this.attackRepo = attackRepo;
		this.outcomeRepo = outcomeRepo;
	}

	public RiskQualityResponse evaluate(String userId) {
		Instant now = Instant.now();
		LocalDate utcToday = LocalDate.ofInstant(now, ZoneOffset.UTC);
		List<RiskPredictionRecord> records = predictionRepo.findForEvaluation(
				userId, utcToday.minusDays(WINDOW_DAYS + 2), utcToday.plusDays(1));
		ZoneId zone = records.stream()
				.filter(r -> r.getIssuedAt() != null)
				.max(Comparator.comparing(RiskPredictionRecord::getIssuedAt))
				.map(r -> parseZone(r.getTimezone()))
				.orElse(ZoneOffset.UTC);
		LocalDate today = LocalDate.ofInstant(now, zone);
		LocalDate from = today.minusDays(WINDOW_DAYS);
		LocalDate to = today.minusDays(1);
		Set<LocalDate> attackDays = attackRepo.findInRange(userId, from, to).stream()
				.map(Attack::getStartDate)
				.filter(Objects::nonNull)
				.filter(d -> !d.isBefore(from) && !d.isAfter(to))
				.collect(Collectors.toSet());
		Set<LocalDate> noAttackDays = outcomeRepo.findByUserIdAndDateBetween(userId, from, to).stream()
				.map(DailyOutcome::getDate)
				.filter(d -> !attackDays.contains(d))
				.collect(Collectors.toSet());
		return summarize(records, attackDays, noAttackDays, from, to, now);
	}

	static RiskQualityResponse summarize(List<RiskPredictionRecord> records, Set<LocalDate> attackDays,
			LocalDate from, LocalDate to, Instant now) {
		// Compatibility helper for the original focused metric tests; production always supplies explicit negatives.
		Set<LocalDate> allDays = records.stream().map(RiskPredictionRecord::getTargetDate)
				.filter(Objects::nonNull).collect(Collectors.toSet());
		allDays.removeAll(attackDays);
		return summarize(records, attackDays, allDays, from, to, now);
	}

	static RiskQualityResponse summarize(List<RiskPredictionRecord> records, Set<LocalDate> attackDays,
			Set<LocalDate> noAttackDays, LocalDate from, LocalDate to, Instant now) {
		Map<LocalDate, RiskPredictionRecord> latestByDay = new HashMap<>();
		for (RiskPredictionRecord record : records) {
			LocalDate target = record.getTargetDate();
			Instant issued = record.getIssuedAt();
			if (target == null || issued == null || target.isBefore(from) || target.isAfter(to)) continue;
			ZoneId zone = parseZone(record.getTimezone());
			if (zone == null || !issued.isBefore(target.atStartOfDay(zone).toInstant())
					|| !target.isBefore(LocalDate.ofInstant(now, zone))) continue;
			latestByDay.merge(target, record,
					(a, b) -> a.getIssuedAt().isAfter(b.getIssuedAt()) ? a : b);
		}

		int attacks = 0, alerts = 0, hits = 0, misses = 0, falseAlerts = 0;
		for (var entry : latestByDay.entrySet()) {
			boolean attack = attackDays.contains(entry.getKey());
			if (!attack && !noAttackDays.contains(entry.getKey())) continue;
			boolean alert = entry.getValue().getScore() >= ALERT_THRESHOLD;
			if (attack) attacks++;
			if (alert) alerts++;
			if (attack && alert) hits++;
			if (attack && !alert) misses++;
			if (!attack && alert) falseAlerts++;
		}
		int covered = (int) latestByDay.keySet().stream()
				.filter(d -> attackDays.contains(d) || noAttackDays.contains(d)).count();
		boolean enough = covered >= MIN_DAYS && attacks >= MIN_ATTACK_DAYS && covered - attacks >= MIN_ATTACK_DAYS;
		return new RiskQualityResponse(from, to, covered, attacks, alerts, hits, misses, falseAlerts,
				enough ? percent(hits, alerts) : null,
				enough ? percent(hits, attacks) : null,
				enough ? percent(attacks, covered) : null,
				enough);
	}

	private static Integer percent(int numerator, int denominator) {
		return denominator == 0 ? null : (int) Math.round(100.0 * numerator / denominator);
	}

	private static ZoneId parseZone(String timezone) {
		if (timezone == null || timezone.isBlank()) return null;
		try { return ZoneId.of(timezone); }
		catch (RuntimeException e) { return null; }
	}
}
