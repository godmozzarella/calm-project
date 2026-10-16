package com.calm.feature.forecast;

import com.calm.feature.forecast.provider.RawForecastDay;
import com.calm.feature.forecast.snapshot.ForecastSnapshot;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class PressureStorageTest {
	@Test
	void convertsProviderHpaBeforeBuildingPersistedForecast() {
		var raw = new RawForecastDay(LocalDate.of(2026, 10, 17), 1000.0, -5.0,
				65.0, null, 5.0, 15.0, 20.0, null, "Europe/Moscow");
		var day = ForecastService.toDayDto(raw);
		assertThat(day.pressureMmHg()).isEqualTo(750.1);
		assertThat(day.pressureDelta24hMmHg()).isEqualTo(-3.8);
	}

	@Test
	void readsOldWeatherSnapshotInMmHgWithoutChangingItsStoredLegacyFields() {
		var snapshot = new ForecastSnapshot();
		ReflectionTestUtils.setField(snapshot, "pressureHpa", 1000.0);
		ReflectionTestUtils.setField(snapshot, "pressureDelta24h", -5.0);
		assertThat(snapshot.getPressureMmHg()).isEqualTo(750.1);
		assertThat(snapshot.getPressureDelta24hMmHg()).isEqualTo(-3.8);
		snapshot.setPressureMmHg(749.0);
		assertThat(snapshot.getPressureMmHg()).isEqualTo(749.0);
	}
}
