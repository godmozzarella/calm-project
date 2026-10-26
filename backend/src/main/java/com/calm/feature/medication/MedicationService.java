package com.calm.feature.medication;

import com.calm.common.exception.NotFoundException;
import com.calm.common.exception.ConflictException;
import com.calm.feature.dictionary.DictionaryEntry;
import com.calm.feature.dictionary.DictionaryRepository;
import com.calm.feature.dictionary.DictionaryType;
import com.calm.feature.medication.dto.MedicationRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.Objects;

@Service
public class MedicationService {
	private final MedicationRepository repo;
	private final DictionaryRepository dictionaryRepo;
	private final PersonalMedicationService personalService;

	public MedicationService(MedicationRepository repo, DictionaryRepository dictionaryRepo,
			PersonalMedicationService personalService) {
		this.repo = repo;
		this.dictionaryRepo = dictionaryRepo;
		this.personalService = personalService;
	}

	public List<Medication> listForUser(String userId) {
		return repo.findByUserIdOrderByDateDescTimeDesc(userId);
	}

	public List<Medication> listInRange(String userId, LocalDate from, LocalDate to) {
		return repo.findInRange(userId, from, to);
	}

	public Medication getOwned(String userId, String id) {
		Medication m = repo.findById(id).orElseThrow(() -> new NotFoundException("Препарат не найден"));
		if (!m.getUserId().equals(userId)) throw new NotFoundException("Препарат не найден");
		return m;
	}

	public Medication create(String userId, MedicationRequest req) {
		Medication m = new Medication();
		if (req.clientId() != null && !req.clientId().isBlank()) {
			Medication existing = repo.findById(req.clientId()).orElse(null);
			if (existing != null) {
				if (!existing.getUserId().equals(userId) || !Objects.equals(existing.getIntakeId(), req.intakeId())) {
					throw new ConflictException("Идентификатор препарата уже используется");
				}
				return existing;
			}
			m.setId(req.clientId());
		}
		m.setUserId(userId);
		applyRequest(userId, m, req);
		return repo.save(m);
	}

	public Medication update(String userId, String id, MedicationRequest req) {
		Medication m = getOwned(userId, id);
		applyRequest(userId, m, req);
		return repo.save(m);
	}

	public void delete(String userId, String id) {
		Medication m = repo.findById(id).orElse(null);
		if (m == null) return;
		if (!m.getUserId().equals(userId)) throw new NotFoundException("Препарат не найден");
		repo.delete(m);
	}

	/** Уникальные дни приёма за месяц (для MOH-метрики). */
	public int overuseDaysInMonth(String userId, int year, int month) {
		LocalDate from = LocalDate.of(year, month, 1);
		LocalDate to = from.plusMonths(1).minusDays(1);
		Set<LocalDate> days = new HashSet<>();
		for (Medication m : listInRange(userId, from, to)) days.add(m.getDate());
		return days.size();
	}

	public List<PersonalMedication> listPersonal(String userId) {
		for (Medication medication : repo.findLegacyPersonal(userId)) {
			if (medication.getName() != null && !Medication.PERSONAL_LABEL.equals(medication.getName())) {
				PersonalMedication personal = personalService.remember(userId, medication.getName());
				medication.setPersonalMedicationId(personal.getId());
				medication.setName(Medication.PERSONAL_LABEL);
				repo.save(medication);
			}
		}
		return personalService.listActive(userId);
	}

	public String displayName(String userId, Medication medication) {
		return medication.getPersonalMedicationId() == null ? medication.getName()
				: personalService.getOwned(userId, medication.getPersonalMedicationId()).getName();
	}

	private void applyRequest(String userId, Medication m, MedicationRequest req) {
		m.setIntakeId(req.intakeId());
		if (req.personalMedicationId() != null || "Другое".equals(req.category())) {
			PersonalMedication personal = req.personalMedicationId() != null
					? personalService.getOwned(userId, req.personalMedicationId())
					: personalService.remember(userId, req.name());
			m.setPersonalMedicationId(personal.getId());
			m.setName(Medication.PERSONAL_LABEL);
		} else {
			m.setPersonalMedicationId(null);
			m.setName(req.name());
		}
		m.setDosage(req.dosage());
		m.setCategory(m.getPersonalMedicationId() == null ? req.category() : "Другое");
		m.setDate(req.date());
		m.setTime(req.time());
		m.setAttackId(req.attackId());
		m.setEffectiveness(req.effectiveness());
		m.setTherapeuticClass(resolveTherapeuticClass(req));
		m.setPurpose(req.purpose());
		m.setNote(req.note());
	}

	/**
	 * Если клиент не передал therapeuticClass — пробуем найти препарат в справочнике
	 * MEDICATION_PRESET по имени и подставить его {@code category}.
	 */
	private String resolveTherapeuticClass(MedicationRequest req) {
		if (req.therapeuticClass() != null && !req.therapeuticClass().isBlank()) {
			return req.therapeuticClass();
		}
		if (req.name() == null) return null;
		String needle = req.name().toLowerCase().trim();
		return dictionaryRepo.findByTypeOrderByOrderAscLabelAsc(DictionaryType.MEDICATION_PRESET).stream()
				.filter(e -> needle.equals(e.getValue().toLowerCase()) || needle.equals(e.getLabel().toLowerCase()))
				.map(DictionaryEntry::getCategory)
				.filter(c -> c != null && !c.isBlank())
				.findFirst()
				.orElse(null);
	}
}
