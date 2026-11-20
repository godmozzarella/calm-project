package com.calm.feature.risk;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.dictionary.DictionaryRepository;
import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.forecast.dto.ForecastResponse;
import com.calm.feature.forecast.snapshot.ForecastSnapshotService;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RiskPredictionServiceTest {
	private static final String USER_ID = "user";
	private static final LocalDate TARGET = LocalDate.of(2026, 11, 19);
	private static final double LATITUDE = 55.75;
	private static final double LONGITUDE = 37.62;

	private final UserRepository users = mock(UserRepository.class);
	private final AttackRepository attacks = mock(AttackRepository.class);
	private final ForecastService forecast = mock(ForecastService.class);
	private final RiskPredictionService service = new RiskPredictionService(
			users, attacks, mock(MedicationRepository.class), mock(DictionaryRepository.class),
			mock(ForecastSnapshotService.class), forecast, mock(RiskPredictionRecordRepository.class),
			mock(RiskTrainingInputSnapshotRepository.class), mock(SharedModelParticipationRepository.class));

	@BeforeEach
	void setUp() {
		User user = new User();
		user.setId(USER_ID);
		user.setLatitude(LATITUDE);
		user.setLongitude(LONGITUDE);
		when(users.findById(USER_ID)).thenReturn(Optional.of(user));
		var day = new ForecastDayDto(TARGET, com.calm.feature.forecast.RiskLevel.HIGH, 85, List.of(),
				null, null, null, null, null, null, null, null, "UTC");
		when(forecast.getForecast(LATITUDE, LONGITUDE))
				.thenReturn(new ForecastResponse("test", List.of(day), false, null));
	}

	@Test
	void capsPersonalRiskForEmptyDiaryAndRetainsWeatherScore() {
		var result = service.predict(USER_ID, TARGET);

		assertThat(result.score()).isEqualTo(64);
		assertThat(result.level()).isEqualTo(RiskLevel.MEDIUM);
		assertThat(result.inputs().weatherScore()).isEqualTo(85);
		assertThat(result.message()).contains("64 из 100");
	}

	@Test
	void retainsHighRiskWhenAnAttackPredatesTheRecentHistoryWindow() {
		when(attacks.existsByUserIdAndStartDateBefore(USER_ID, TARGET)).thenReturn(true);

		var result = service.predict(USER_ID, TARGET);

		assertThat(result.score()).isEqualTo(85);
		assertThat(result.level()).isEqualTo(RiskLevel.HIGH);
		assertThat(result.message()).isNull();
	}

	@Test
	void includesRecentAttackContribution() {
		Attack yesterday = new Attack();
		yesterday.setStartDate(TARGET.minusDays(1));
		when(attacks.findInRange(USER_ID, TARGET.minusDays(90), TARGET.minusDays(1)))
				.thenReturn(List.of(yesterday));

		var result = service.predict(USER_ID, TARGET);

		assertThat(result.score()).isEqualTo(100);
		assertThat(result.level()).isEqualTo(RiskLevel.HIGH);
		assertThat(result.reasons()).contains("Приступ был вчера");
	}
}
