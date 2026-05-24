package com.calm.feature.medication;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.medication.dto.MedicationRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class MedicationService {

	private final MedicationRepository repo;

	public MedicationService(MedicationRepository repo) {
		this.repo = repo;
	}

	public List<Medication> listForUser(String userId) {
		return repo.findByUserIdOrderByDateDescTimeDesc(userId);
	}

	public List<Medication> listInRange(String userId, LocalDate from, LocalDate to) {
		return repo.findByUserIdAndDateBetweenOrderByDateAscTimeAsc(userId, from, to);
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
		m.setTherapeuticClass(req.therapeuticClass());
		m.setPurpose(req.purpose());
		m.setNote(req.note());
	}
}
