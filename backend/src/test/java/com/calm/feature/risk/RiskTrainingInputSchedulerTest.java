package com.calm.feature.risk;

import com.calm.feature.forecast.ForecastService;
import com.calm.feature.forecast.RiskLevel;
import com.calm.feature.forecast.dto.ForecastDayDto;
import com.calm.feature.forecast.dto.ForecastResponse;
import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

class RiskTrainingInputSchedulerTest {
	@Test
	void capturesTomorrowForConsentingUserWithoutOpeningForecastScreen() {
		var participations = mock(SharedModelParticipationRepository.class);
		var users = mock(UserRepository.class);
		var forecast = mock(ForecastService.class);
		var risk = mock(RiskPredictionService.class);
		var snapshots = mock(RiskTrainingInputSnapshotRepository.class);
		var participation = new SharedModelParticipation("pilot-user");
		participation.grant(SharedModelConsentPolicy.VERSION, SharedModelConsentPolicy.DIGEST, Instant.now());
		var user = new User("pilot@example.test", "Pilot", "hash");
		user.setId("pilot-user");
		user.setLatitude(55.75);
		user.setLongitude(37.62);
		var tomorrow = LocalDate.now(ZoneOffset.UTC).plusDays(1);
		var day = new ForecastDayDto(tomorrow, RiskLevel.LOW, 12, List.of(),
				756.1, -1.5, 60.0, 5.0, 10.0, 20.0, 14.0, 2.0, "UTC");
		when(participations.findAll()).thenReturn(List.of(participation));
		when(users.findById("pilot-user")).thenReturn(Optional.of(user));
		when(forecast.getForecast(55.75, 37.62))
				.thenReturn(new ForecastResponse("test", List.of(day), false, Instant.now()));
		when(snapshots.findByUserIdAndTargetDate("pilot-user", tomorrow)).thenReturn(Optional.empty());

		new RiskTrainingInputScheduler(participations, users, forecast, risk, snapshots).captureUpcomingDays();

		verify(risk).captureTrainingInput("pilot-user", tomorrow);
	}

	@Test
	void skipsWithdrawnParticipant() {
		var participations = mock(SharedModelParticipationRepository.class);
		var users = mock(UserRepository.class);
		var forecast = mock(ForecastService.class);
		var risk = mock(RiskPredictionService.class);
		var snapshots = mock(RiskTrainingInputSnapshotRepository.class);
		when(participations.findAll()).thenReturn(List.of(new SharedModelParticipation("pilot-user")));

		new RiskTrainingInputScheduler(participations, users, forecast, risk, snapshots).captureUpcomingDays();

		verifyNoInteractions(users, forecast, risk, snapshots);
	}

	@Test
	void refreshesOldSchemaSnapshotBeforeTargetDay() {
		var participations = mock(SharedModelParticipationRepository.class);
		var users = mock(UserRepository.class);
		var forecast = mock(ForecastService.class);
		var risk = mock(RiskPredictionService.class);
		var snapshots = mock(RiskTrainingInputSnapshotRepository.class);
		var participation = new SharedModelParticipation("pilot-user");
		participation.grant(SharedModelConsentPolicy.VERSION, SharedModelConsentPolicy.DIGEST, Instant.now());
		var user = new User("pilot@example.test", "Pilot", "hash");
		user.setId("pilot-user");
		user.setLatitude(55.75);
		user.setLongitude(37.62);
		var tomorrow = LocalDate.now(ZoneOffset.UTC).plusDays(1);
		var day = new ForecastDayDto(tomorrow, RiskLevel.LOW, 12, List.of(),
				756.1, -1.5, 60.0, 5.0, 10.0, 20.0, 14.0, 2.0, "UTC");
		var old = new RiskTrainingInputSnapshot("pilot-user", tomorrow, Instant.now(), "UTC",
				"55.75,37.62", 42, com.calm.feature.risk.RiskLevel.MEDIUM,
				2, "personal-rules-v1", null, null);
		when(participations.findAll()).thenReturn(List.of(participation));
		when(users.findById("pilot-user")).thenReturn(Optional.of(user));
		when(forecast.getForecast(55.75, 37.62))
				.thenReturn(new ForecastResponse("test", List.of(day), false, Instant.now()));
		when(snapshots.findByUserIdAndTargetDate("pilot-user", tomorrow)).thenReturn(Optional.of(old));

		new RiskTrainingInputScheduler(participations, users, forecast, risk, snapshots).captureUpcomingDays();

		verify(risk).captureTrainingInput("pilot-user", tomorrow);
	}
}
