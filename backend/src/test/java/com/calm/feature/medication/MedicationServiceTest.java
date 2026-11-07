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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MedicationServiceTest {
	@Mock MedicationRepository repo;
	@Mock DictionaryRepository dictionaryRepo;
	@Mock PersonalMedicationService personalService;
	@InjectMocks MedicationService service;

	private MedicationRequest request(String clientId) {
		return new MedicationRequest(clientId, "intake-1", "Ибупрофен", null, "400",
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
	void customMedicineUsesPrivateNameButStoresGenericLabelInIntake() {
		var personal = new PersonalMedication("user-1", "Мой препарат", "мой препарат");
		personal.setId("personal-1");
		var custom = new MedicationRequest(null, "intake-2", "Мой препарат", null, "100",
				"Другое", LocalDate.of(2026, 10, 11), LocalTime.NOON,
				null, null, null, null, "");
		when(personalService.remember("user-1", "Мой препарат")).thenReturn(personal);
		when(personalService.getOwned("user-1", "personal-1")).thenReturn(personal);
		when(repo.save(any(Medication.class))).thenAnswer(invocation -> invocation.getArgument(0));

		Medication saved = service.create("user-1", custom);

		assertThat(saved.getName()).isEqualTo(Medication.PERSONAL_LABEL);
		assertThat(saved.getPersonalMedicationId()).isEqualTo("personal-1");
		assertThat(saved.trainingName()).isEqualTo(Medication.PERSONAL_LABEL);
		assertThat(service.displayName("user-1", saved)).isEqualTo("Мой препарат");
		verify(personalService).rememberDosageIfAbsent("user-1", "personal-1", "100");
	}

	@Test
	void importingOlderPersonalMedicineKeepsItInThePrivateList() {
		var oldIntake = new Medication();
		oldIntake.setUserId("user-1");
		oldIntake.setName("Старое название");
		oldIntake.setCategory("Другое");
		var personal = new PersonalMedication("user-1", "Старое название", "старое название");
		personal.setId("personal-old");
		when(repo.findLegacyPersonal("user-1")).thenReturn(List.of(oldIntake));
		when(personalService.remember("user-1", "Старое название")).thenReturn(personal);
		when(personalService.listActive("user-1")).thenReturn(List.of(personal));
		when(repo.findPersonalHistoryForDefaults(eq("user-1"), anySet())).thenReturn(List.of());

		assertThat(service.listPersonal("user-1")).containsExactly(personal);
		assertThat(oldIntake.getName()).isEqualTo(Medication.PERSONAL_LABEL);
		assertThat(oldIntake.getPersonalMedicationId()).isEqualTo("personal-old");
		verify(repo).save(oldIntake);
	}

	@Test
	void existingPersonalMedicineGetsDefaultFromEarliestRecordedDose() {
		var personal = new PersonalMedication("user-1", "Мой препарат", "мой препарат");
		personal.setId("personal-1");
		var first = new Medication();
		first.setPersonalMedicationId("personal-1");
		first.setDosage("100");
		var later = new Medication();
		later.setPersonalMedicationId("personal-1");
		later.setDosage("200");
		when(repo.findLegacyPersonal("user-1")).thenReturn(List.of());
		when(personalService.listActive("user-1")).thenReturn(List.of(personal));
		when(repo.findPersonalHistoryForDefaults(eq("user-1"), anySet())).thenReturn(List.of(first, later));

		service.listPersonal("user-1");

		verify(personalService).rememberDosageIfAbsent("user-1", "personal-1", "100");
		verify(personalService, never()).rememberDosageIfAbsent("user-1", "personal-1", "200");
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
