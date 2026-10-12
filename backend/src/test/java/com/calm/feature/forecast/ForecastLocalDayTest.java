package com.calm.feature.forecast;

import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.forecast.dto.ForecastResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ForecastLocalDayTest {
	@Test
	void cacheDayChangesAtMidnightInForecastLocation() {
		ForecastDayDto day = new ForecastDayDto(LocalDate.of(2026, 10, 11), RiskLevel.LOW, 10,
				List.of(), null, null, null, null, null, null, null, "Europe/Moscow");
		ForecastResponse response = new ForecastResponse("openmeteo", List.of(day), false, Instant.EPOCH);

		assertThat(ForecastService.startsOnLocalToday(response, Instant.parse("2026-10-11T20:59:59Z"))).isTrue();
		assertThat(ForecastService.startsOnLocalToday(response, Instant.parse("2026-10-11T21:00:00Z"))).isFalse();
	}
}
