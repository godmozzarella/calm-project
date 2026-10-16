package com.calm.feature.attack;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.attack.dto.AttackRequest;
import com.calm.feature.risk.DailyOutcome;
import com.calm.feature.risk.DailyOutcomeRepository;
import org.springframework.web.server.ResponseStatusException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit-тесты для {@link AttackService}: проверяем CRUD-логику и контроль доступа.
 * Репозиторий мокается через Mockito — Mongo не нужна.
 */
@ExtendWith(MockitoExtension.class)
class AttackServiceTest {

	@Mock
	AttackRepository repo;

	@InjectMocks
	AttackService service;

	private AttackRequest sampleRequest;

	@BeforeEach
	void setUp() {
		sampleRequest = new AttackRequest(
				LocalDate.of(2026, 5, 25),
				LocalTime.of(10, 30),
				LocalDate.of(2026, 5, 25),
				LocalTime.of(12, 0),
				false,
				7,
				AttackType.PULSATING,
				Set.of("nausea"),
				Set.of("stress"),
				Map.of("forehead", "red"),
				"Тестовый приступ"
		);
	}

	@Test
	@DisplayName("create: новый приступ привязывается к userId и сохраняется")
	void create_setsUserIdAndSaves() {
		when(repo.save(any(Attack.class))).thenAnswer(inv -> inv.getArgument(0));

		Attack saved = service.create("user-1", sampleRequest);

		assertThat(saved.getUserId()).isEqualTo("user-1");
		assertThat(saved.getIntensity()).isEqualTo(7);
		assertThat(saved.getType()).isEqualTo(AttackType.PULSATING);
		assertThat(saved.getPainZones()).containsEntry("forehead", "red");
		verify(repo).save(any(Attack.class));
	}

	@Test
	@DisplayName("create: при ongoing=true endDate/endTime обнуляются")
	void create_ongoingClearsEndFields() {
		AttackRequest ongoing = new AttackRequest(
				LocalDate.of(2026, 5, 25), LocalTime.of(10, 0),
				LocalDate.of(2026, 5, 25), LocalTime.of(11, 0),
				true, 5, AttackType.PRESSING,
				null, null, null, null
		);
		when(repo.save(any(Attack.class))).thenAnswer(inv -> inv.getArgument(0));

		Attack saved = service.create("user-1", ongoing);

		assertThat(saved.isOngoing()).isTrue();
		assertThat(saved.getEndDate()).isNull();
		assertThat(saved.getEndTime()).isNull();
	}

	@Test
	void create_clearsQuietConfirmationsAcrossAttackInterval() {
		var outcomes = mock(DailyOutcomeRepository.class);
		var withOutcomes = new AttackService(repo, outcomes);
		var start = LocalDate.of(2026, 5, 25);
		var end = start.plusDays(2);
		var spanning = new AttackRequest(start, LocalTime.of(10, 0), end, LocalTime.of(11, 0),
				false, 5, AttackType.PRESSING, null, null, null, null);
		when(repo.save(any(Attack.class))).thenAnswer(inv -> inv.getArgument(0));
		when(outcomes.findByUserIdAndDateBetween("user-1", start, end)).thenReturn(List.of(
				new DailyOutcome("user-1", start, Instant.now()),
				new DailyOutcome("user-1", start.plusDays(1), Instant.now()),
				new DailyOutcome("user-1", end, Instant.now())));
		withOutcomes.create("user-1", spanning);
		verify(outcomes).deleteByUserIdAndDate("user-1", start);
		verify(outcomes).deleteByUserIdAndDate("user-1", start.plusDays(1));
		verify(outcomes).deleteByUserIdAndDate("user-1", end);
	}

	@Test
	@DisplayName("getOwned: чужой приступ вызывает NotFoundException")
	void getOwned_foreignAttackThrows() {
		Attack other = new Attack();
		other.setId("attack-1");
		other.setUserId("other-user");
		when(repo.findById("attack-1")).thenReturn(Optional.of(other));

		assertThatThrownBy(() -> service.getOwned("user-1", "attack-1"))
				.isInstanceOf(NotFoundException.class)
				.hasMessageContaining("не найден");
	}

	@Test
	@DisplayName("getOwned: несуществующий id вызывает NotFoundException")
	void getOwned_missingThrows() {
		when(repo.findById("missing")).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.getOwned("user-1", "missing"))
				.isInstanceOf(NotFoundException.class);
	}

	@Test
	@DisplayName("update: применяет изменения и сохраняет")
	void update_applyAndSave() {
		Attack existing = new Attack();
		existing.setId("attack-1");
		existing.setUserId("user-1");
		existing.setIntensity(3);
		when(repo.findById("attack-1")).thenReturn(Optional.of(existing));
		when(repo.save(any(Attack.class))).thenAnswer(inv -> inv.getArgument(0));

		Attack updated = service.update("user-1", "attack-1", sampleRequest);

		assertThat(updated.getIntensity()).isEqualTo(7);
		assertThat(updated.getNote()).isEqualTo("Тестовый приступ");
		verify(repo).save(existing);
	}

	@Test
	@DisplayName("delete: удаление чужого приступа блокируется")
	void delete_foreignBlocked() {
		Attack other = new Attack();
		other.setId("attack-1");
		other.setUserId("other-user");
		when(repo.findById("attack-1")).thenReturn(Optional.of(other));

		assertThatThrownBy(() -> service.delete("user-1", "attack-1"))
				.isInstanceOf(NotFoundException.class);

		verify(repo, never()).delete(any());
	}

	@Test
	void rejectsEndBeforeStartWithoutSaving() {
		AttackRequest invalid = new AttackRequest(
				LocalDate.of(2026, 5, 25), LocalTime.of(10, 0),
				LocalDate.of(2026, 5, 25), LocalTime.of(9, 0),
				false, 5, AttackType.PRESSING, null, null, null, null);
		assertThatThrownBy(() -> service.create("user-1", invalid))
				.isInstanceOf(ResponseStatusException.class)
				.hasMessageContaining("позже начала");
		verify(repo, never()).save(any());
	}

	@Test
	void editingCanClearSymptomsTriggersAndPainZones() {
		Attack existing = new Attack();
		existing.setUserId("user-1");
		existing.setSymptoms(Set.of("nausea"));
		existing.setTriggers(Set.of("stress"));
		existing.setPainZones(Map.of("forehead", "red"));
		when(repo.findById("attack-1")).thenReturn(Optional.of(existing));
		when(repo.save(any(Attack.class))).thenAnswer(inv -> inv.getArgument(0));
		AttackRequest cleared = new AttackRequest(
				LocalDate.of(2026, 5, 25), LocalTime.of(10, 0),
				LocalDate.of(2026, 5, 25), LocalTime.of(11, 0),
				false, 5, AttackType.PRESSING, null, null, null, null);
		Attack updated = service.update("user-1", "attack-1", cleared);
		assertThat(updated.getSymptoms()).isEmpty();
		assertThat(updated.getTriggers()).isEmpty();
		assertThat(updated.getPainZones()).isEmpty();
	}
}
