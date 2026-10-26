package com.calm.feature.medication;

import com.calm.common.exception.NotFoundException;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class PersonalMedicationServiceTest {
	@Test
	void reusesOwnNameIgnoringCaseAndRepeatedSpaces() {
		var repo = mock(PersonalMedicationRepository.class);
		var existing = new PersonalMedication("user-1", "Мой препарат", "мой препарат");
		when(repo.findByUserIdAndNormalizedName("user-1", "мой препарат"))
				.thenReturn(Optional.of(existing));

		var result = new PersonalMedicationService(repo).remember("user-1", "  МОЙ   препарат  ");

		assertThat(result).isSameAs(existing);
		verify(repo, never()).save(any());
	}

	@Test
	void doesNotOpenAnotherUsersPersonalName() {
		var repo = mock(PersonalMedicationRepository.class);
		when(repo.findByIdAndUserId("personal-1", "user-2")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> new PersonalMedicationService(repo).getOwned("user-2", "personal-1"))
				.isInstanceOf(NotFoundException.class);
	}

	@Test
	void archiveHidesNameButKeepsItForPastEntries() {
		var repo = mock(PersonalMedicationRepository.class);
		var personal = new PersonalMedication("user-1", "Мой препарат", "мой препарат");
		personal.setId("personal-1");
		when(repo.findByIdAndUserId("personal-1", "user-1")).thenReturn(Optional.of(personal));
		when(repo.findByUserIdOrderByNameAsc("user-1")).thenReturn(List.of(personal));

		var service = new PersonalMedicationService(repo);
		service.archive("user-1", "personal-1");

		assertThat(service.listActive("user-1")).isEmpty();
		assertThat(service.getOwned("user-1", "personal-1").getName()).isEqualTo("Мой препарат");
		verify(repo).save(personal);
	}

	@Test
	void cannotArchiveAnotherUsersName() {
		var repo = mock(PersonalMedicationRepository.class);
		when(repo.findByIdAndUserId("personal-1", "user-2")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> new PersonalMedicationService(repo).archive("user-2", "personal-1"))
				.isInstanceOf(NotFoundException.class);
		verify(repo, never()).save(any());
	}

	@Test
	void enteringArchivedNameMakesItAvailableAgain() {
		var repo = mock(PersonalMedicationRepository.class);
		var personal = new PersonalMedication("user-1", "Мой препарат", "мой препарат");
		personal.setArchived(true);
		when(repo.findByUserIdAndNormalizedName("user-1", "мой препарат"))
				.thenReturn(Optional.of(personal));
		when(repo.save(personal)).thenReturn(personal);

		var result = new PersonalMedicationService(repo).remember("user-1", "Мой препарат");

		assertThat(result.isArchived()).isFalse();
		verify(repo).save(personal);
	}
}
