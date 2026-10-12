package com.calm.feature.medication;

import com.calm.common.exception.ConflictException;
import com.calm.feature.dictionary.DictionaryRepository;
import com.calm.feature.medication.dto.MedicationRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicationServiceTest {
	@Mock MedicationRepository repo;
	@Mock DictionaryRepository dictionaryRepo;
	@InjectMocks MedicationService service;

	private MedicationRequest request(String clientId) {
		return new MedicationRequest(clientId, "intake-1", "Ибупрофен", "400",
				"Таблетки", LocalDate.of(2026, 10, 11), LocalTime.NOON,
				null, null, "nsaid", null, "");
	}

	@Test
	void retryingCreateReusesTheSameMedication() {
		when(repo.findById("item-1")).thenReturn(Optional.empty());
		when(repo.save(any(Medication.class))).thenAnswer(invocation -> invocation.getArgument(0));
		Medication first = service.create("user-1", request("item-1"));
		assertThat(first.getId()).isEqualTo("item-1");
		assertThat(first.getIntakeId()).isEqualTo("intake-1");

		when(repo.findById("item-1")).thenReturn(Optional.of(first));
		Medication retried = service.create("user-1", request("item-1"));
		assertThat(retried).isSameAs(first);
		verify(repo, times(1)).save(any(Medication.class));
	}

	@Test
	void createRejectsClientIdOwnedByAnotherUser() {
		Medication other = new Medication();
		other.setId("item-1");
		other.setUserId("user-2");
		when(repo.findById("item-1")).thenReturn(Optional.of(other));
		assertThatThrownBy(() -> service.create("user-1", request("item-1")))
				.isInstanceOf(ConflictException.class);
		verify(repo, never()).save(any());
	}

	@Test
	void deletingAnAlreadyRemovedItemIsIdempotent() {
		when(repo.findById("gone")).thenReturn(Optional.empty());
		service.delete("user-1", "gone");
		verify(repo, never()).delete(any());
	}
}
