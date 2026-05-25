package com.calm.feature.medication;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.dictionary.DictionaryEntry;
import com.calm.feature.dictionary.DictionaryRepository;
import com.calm.feature.dictionary.DictionaryType;
import com.calm.feature.medication.dto.MedicationRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class MedicationService {

	private final MedicationRepository repo;
	private final DictionaryRepository dictionaryRepo;

	public MedicationService(MedicationRepository repo, DictionaryRepository dictionaryRepo) {
		this.repo = repo;
		this.dictionaryRepo = dictionaryRepo;
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
		m.setUserId(userId);
		applyRequest(m, req);
		return repo.save(m);
	}

	public Medication update(String userId, String id, MedicationRequest req) {
		Medication m = getOwned(userId, id);
		applyRequest(m, req);
		return repo.save(m);
	}

	public void delete(String userId, String id) {
		Medication m = getOwned(userId, id);
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

	private void applyRequest(Medication m, MedicationRequest req) {
		m.setName(req.name());
		m.setDosage(req.dosage());
		m.setCategory(req.category());
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
