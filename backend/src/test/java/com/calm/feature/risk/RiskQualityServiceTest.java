package com.calm.feature.risk;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RiskQualityServiceTest {
	private static final ZoneId MOSCOW = ZoneId.of("Europe/Moscow");

	@Test
	void ignoresPredictionsMadeAfterLocalDayStartedAndChoosesLatestEligible() {
		LocalDate day = LocalDate.of(2026, 10, 10);
		Instant start = day.atStartOfDay(MOSCOW).toInstant();
		List<RiskPredictionRecord> records = List.of(
				new RiskPredictionRecord("u", day, start.minusSeconds(3600), "Europe/Moscow", 70, RiskLevel.HIGH),
				new RiskPredictionRecord("u", day, start.plusSeconds(3600), "Europe/Moscow", 10, RiskLevel.LOW)
		);

		RiskQualityResponse result = RiskQualityService.summarize(records, Set.of(day),
				day, day, start.plusSeconds(86_400));

		assertThat(result.daysCovered()).isEqualTo(1);
		assertThat(result.hitDays()).isEqualTo(1);
		assertThat(result.alertDays()).isEqualTo(1);
		assertThat(result.precisionPercent()).isNull();
	}

	@Test
	void computesRatesOnlyWhenBothAttackAndQuietDaysAreRepresented() {
		LocalDate from = LocalDate.of(2026, 9, 1);
		List<RiskPredictionRecord> records = new ArrayList<>();
		Set<LocalDate> attacks = new HashSet<>();
		for (int i = 0; i < 30; i++) {
			LocalDate day = from.plusDays(i);
			boolean attack = i < 5;
			if (attack) attacks.add(day);
			int score = attack || i < 8 ? 40 : 10;
			records.add(new RiskPredictionRecord("u", day,
					day.minusDays(1).atTime(12, 0).atZone(MOSCOW).toInstant(),
					"Europe/Moscow", score, score >= 35 ? RiskLevel.MEDIUM : RiskLevel.LOW));
		}

		RiskQualityResponse result = RiskQualityService.summarize(records, attacks,
				from, from.plusDays(29), from.plusDays(31).atStartOfDay(MOSCOW).toInstant());

		assertThat(result.enoughData()).isTrue();
		assertThat(result.daysCovered()).isEqualTo(30);
		assertThat(result.attackDays()).isEqualTo(5);
		assertThat(result.hitDays()).isEqualTo(5);
		assertThat(result.falseAlertDays()).isEqualTo(3);
		assertThat(result.precisionPercent()).isEqualTo(63);
		assertThat(result.recallPercent()).isEqualTo(100);
		assertThat(result.baselineAttackRatePercent()).isEqualTo(17);
	}
}
