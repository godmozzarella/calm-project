package com.calm.feature.risk;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SharedModelParticipationServiceTest {
	@Test
	void closedEnrollmentRejectsNewConsentWithoutWriting() {
		var repository = mock(SharedModelParticipationRepository.class);
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.empty());
		var service = new SharedModelParticipationService(repository, false, "", "");

		assertThat(service.get("pilot-user").enrollmentOpen()).isFalse();
		assertThat(service.get("pilot-user").showConsentPrompt()).isFalse();
		assertThatThrownBy(() -> service.grant("pilot-user", SharedModelParticipationService.CONSENT_VERSION,
			SharedModelConsentPolicy.DIGEST))
			.isInstanceOf(ResponseStatusException.class)
			.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
				.isEqualTo(HttpStatus.CONFLICT));
		verify(repository, never()).save(any());
	}

	@Test
	void withdrawalRemainsAvailableWhileEnrollmentClosed() {
		var repository = mock(SharedModelParticipationRepository.class);
		var participation = new SharedModelParticipation("pilot-user");
		participation.grant(SharedModelParticipationService.CONSENT_VERSION, SharedModelConsentPolicy.DIGEST, Instant.now());
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.of(participation));
		when(repository.save(participation)).thenReturn(participation);
		var service = new SharedModelParticipationService(repository, false, "", "");

		var response = service.withdraw("pilot-user");

		assertThat(response.participating()).isFalse();
		assertThat(response.enrollmentOpen()).isFalse();
		verify(repository).save(participation);
	}

	@Test
	void openEnrollmentAcceptsExplicitConsent() {
		var repository = mock(SharedModelParticipationRepository.class);
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.empty());
		when(repository.save(any(SharedModelParticipation.class))).thenAnswer(call -> call.getArgument(0));
		var service = new SharedModelParticipationService(repository, true, SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST);

		var displayed = service.get("pilot-user");
		var response = service.grant("pilot-user", displayed.currentConsentVersion(), displayed.currentConsentDigest());

		assertThat(response.participating()).isTrue();
		assertThat(response.enrollmentOpen()).isTrue();
		assertThat(response.consentVersion()).isEqualTo(SharedModelParticipationService.CONSENT_VERSION);
		assertThat(response.consentCurrent()).isTrue();
		assertThat(displayed.showConsentPrompt()).isTrue();
		assertThat(response.showConsentPrompt()).isFalse();
	}

	@Test
	void decliningCurrentTermsIsRememberedWithoutJoining() {
		var repository = mock(SharedModelParticipationRepository.class);
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.empty());
		when(repository.save(any(SharedModelParticipation.class))).thenAnswer(call -> call.getArgument(0));
		var service = new SharedModelParticipationService(repository, true, SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST);
		var displayed = service.get("pilot-user");

		var response = service.decline("pilot-user", displayed.currentConsentVersion(), displayed.currentConsentDigest());

		assertThat(response.participating()).isFalse();
		assertThat(response.showConsentPrompt()).isFalse();
		assertThat(response.consentCurrent()).isFalse();
		verify(repository).save(any(SharedModelParticipation.class));
	}

	@Test
	void decliningNewTermsWithdrawsOldParticipationAndClosesPrompt() {
		var repository = mock(SharedModelParticipationRepository.class);
		var participation = new SharedModelParticipation("pilot-user");
		participation.grant("shared-model-pilot-v1", "old-digest", Instant.now());
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.of(participation));
		when(repository.save(participation)).thenReturn(participation);
		var service = new SharedModelParticipationService(repository, true, SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST);

		var displayed = service.get("pilot-user");
		assertThat(displayed.showConsentPrompt()).isTrue();
		var response = service.decline("pilot-user", displayed.currentConsentVersion(), displayed.currentConsentDigest());

		assertThat(response.participating()).isFalse();
		assertThat(response.showConsentPrompt()).isFalse();
		assertThat(participation.getEvents()).extracting(SharedModelParticipation.ParticipationEvent::action)
			.containsExactly("GRANTED", "WITHDRAWN", "DECLINED");
		assertThat(participation.getEvents()).last().satisfies(event -> {
			assertThat(event.consentVersion()).isEqualTo(SharedModelConsentPolicy.VERSION);
			assertThat(event.consentDigest()).isEqualTo(SharedModelConsentPolicy.DIGEST);
		});
		verify(repository).save(participation);
	}

	@Test
	void administratorCanBlockAndLaterRestoreParticipationAccess() {
		var repository = mock(SharedModelParticipationRepository.class);
		var participation = new SharedModelParticipation("pilot-user");
		participation.grant(SharedModelConsentPolicy.VERSION, SharedModelConsentPolicy.DIGEST, Instant.now());
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.of(participation));
		when(repository.save(any(SharedModelParticipation.class))).thenAnswer(call -> call.getArgument(0));
		var service = new SharedModelParticipationService(repository, true, SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST);

		var blocked = service.setAdminBlocked("pilot-user", "admin-user", true);

		assertThat(blocked.adminBlocked()).isTrue();
		assertThat(blocked.participating()).isFalse();
		assertThat(blocked.showConsentPrompt()).isFalse();
		assertThat(participation.getEvents()).last().satisfies(event -> {
			assertThat(event.action()).isEqualTo("ADMIN_BLOCKED");
			assertThat(event.actorUserId()).isEqualTo("admin-user");
		});
		assertThatThrownBy(() -> service.grant("pilot-user", SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST))
			.isInstanceOf(ResponseStatusException.class)
			.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
				.isEqualTo(HttpStatus.FORBIDDEN));

		var restored = service.setAdminBlocked("pilot-user", "admin-user", false);
		assertThat(restored.adminBlocked()).isFalse();
		assertThat(restored.participating()).isFalse();
		assertThat(restored.showConsentPrompt()).isTrue();
	}

	@Test
	void newConsentVersionRequiresExplicitRenewal() {
		var repository = mock(SharedModelParticipationRepository.class);
		var participation = new SharedModelParticipation("pilot-user");
		participation.grant("old-version", "old-digest", Instant.now());
		when(repository.findByUserId("pilot-user")).thenReturn(Optional.of(participation));
		when(repository.save(participation)).thenReturn(participation);
		var service = new SharedModelParticipationService(repository, true, SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST);

		assertThat(service.get("pilot-user").consentCurrent()).isFalse();
		var displayed = service.get("pilot-user");
		var response = service.grant("pilot-user", displayed.currentConsentVersion(), displayed.currentConsentDigest());

		assertThat(response.consentCurrent()).isTrue();
		assertThat(response.consentVersion()).isEqualTo(SharedModelParticipationService.CONSENT_VERSION);
		assertThat(participation.getEvents()).extracting(SharedModelParticipation.ParticipationEvent::action)
			.containsExactly("GRANTED", "RECONSENTED");
		verify(repository).save(participation);
	}

	@Test
	void staleOrMissingVersionCannotCreateConsent() {
		var repository = mock(SharedModelParticipationRepository.class);
		var service = new SharedModelParticipationService(repository, true, SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST);

		for (String version : new String[] { "old-version", "" }) {
			assertThatThrownBy(() -> service.grant("pilot-user", version, SharedModelConsentPolicy.DIGEST))
				.isInstanceOf(ResponseStatusException.class)
				.satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
					.isEqualTo(HttpStatus.CONFLICT));
		}
		assertThatThrownBy(() -> service.grant("pilot-user", null, SharedModelConsentPolicy.DIGEST))
			.isInstanceOf(ResponseStatusException.class);
		assertThatThrownBy(() -> service.grant("pilot-user", SharedModelConsentPolicy.VERSION, "old-text"))
			.isInstanceOf(ResponseStatusException.class);
		verify(repository, never()).save(any());
	}

	@Test
	void enrollmentRequiresApprovedVersionInAdditionToOpenFlag() {
		var repository = mock(SharedModelParticipationRepository.class);
		var service = new SharedModelParticipationService(repository, true, "old-version", "old-digest");

		assertThat(service.get("pilot-user").enrollmentOpen()).isFalse();
		assertThatThrownBy(() -> service.grant("pilot-user", SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST)).isInstanceOf(ResponseStatusException.class);
		verify(repository, never()).save(any());
	}
}
