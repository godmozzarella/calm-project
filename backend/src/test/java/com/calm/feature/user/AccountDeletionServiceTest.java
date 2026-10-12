package com.calm.feature.user;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.attack.AttackRepository;
import com.calm.feature.auth.AuthSessionRepository;
import com.calm.feature.medication.MedicationRepository;
import com.calm.feature.risk.DailyOutcomeRepository;
import com.calm.feature.risk.RiskPredictionRecordRepository;
import com.calm.feature.risk.SharedModelParticipationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AccountDeletionServiceTest {
	@TempDir Path uploadDir;

	@Test
	void deletesAllAccountOwnedRecordsIncludingTrainingInputsAndConsent() {
		var users = mock(UserRepository.class);
		var attacks = mock(AttackRepository.class);
		var medications = mock(MedicationRepository.class);
		var sessions = mock(AuthSessionRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var outcomes = mock(DailyOutcomeRepository.class);
		var participation = mock(SharedModelParticipationRepository.class);
		var user = new User("pilot@example.test", "Pilot", "hash");
		user.setId("pilot-user");
		when(users.findById("pilot-user")).thenReturn(Optional.of(user));
		var service = new AccountDeletionService(users, attacks, medications, sessions,
			predictions, outcomes, participation, uploadDir.toString());

		service.deleteAccount("pilot-user");

		verify(predictions).deleteByUserId("pilot-user");
		verify(outcomes).deleteByUserId("pilot-user");
		verify(participation).deleteByUserId("pilot-user");
		verify(attacks).deleteByUserId("pilot-user");
		verify(medications).deleteByUserId("pilot-user");
		verify(sessions).deleteByUserId("pilot-user");
		verify(users).delete(user);
	}

	@Test
	void missingAccountDoesNotDeleteSomeoneElsesData() {
		var users = mock(UserRepository.class);
		var attacks = mock(AttackRepository.class);
		var medications = mock(MedicationRepository.class);
		var sessions = mock(AuthSessionRepository.class);
		var predictions = mock(RiskPredictionRecordRepository.class);
		var outcomes = mock(DailyOutcomeRepository.class);
		var participation = mock(SharedModelParticipationRepository.class);
		when(users.findById("missing")).thenReturn(Optional.empty());
		var service = new AccountDeletionService(users, attacks, medications, sessions,
			predictions, outcomes, participation, uploadDir.toString());

		assertThatThrownBy(() -> service.deleteAccount("missing")).isInstanceOf(NotFoundException.class);
		verifyNoInteractions(attacks, medications, sessions, predictions, outcomes, participation);
	}
}
