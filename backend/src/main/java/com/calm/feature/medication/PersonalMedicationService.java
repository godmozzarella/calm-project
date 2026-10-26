package com.calm.feature.medication;

import com.calm.common.exception.NotFoundException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service
public class PersonalMedicationService {
	private final PersonalMedicationRepository repo;

	public PersonalMedicationService(PersonalMedicationRepository repo) {
		this.repo = repo;
	}

	public List<PersonalMedication> list(String userId) {
		return repo.findByUserIdOrderByNameAsc(userId);
	}

	public List<PersonalMedication> listActive(String userId) {
		return list(userId).stream().filter(medication -> !medication.isArchived()).toList();
	}

	public void archive(String userId, String id) {
		PersonalMedication medication = getOwned(userId, id);
		if (medication.isArchived()) return;
		medication.setArchived(true);
		repo.save(medication);
	}

	public PersonalMedication getOwned(String userId, String id) {
		return repo.findByIdAndUserId(id, userId)
				.orElseThrow(() -> new NotFoundException("Свой препарат не найден"));
	}

	public PersonalMedication remember(String userId, String rawName) {
		String name = rawName == null ? "" : rawName.trim().replaceAll("\\s+", " ");
		if (name.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите название препарата");
		}
		String normalized = Normalizer.normalize(name, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
		return repo.findByUserIdAndNormalizedName(userId, normalized).map(existing -> {
			if (existing.isArchived()) {
				existing.setArchived(false);
				return repo.save(existing);
			}
			return existing;
		}).orElseGet(() -> {
			try {
				return repo.save(new PersonalMedication(userId, name, normalized));
			} catch (DuplicateKeyException e) {
				return repo.findByUserIdAndNormalizedName(userId, normalized).orElseThrow(() -> e);
			}
		});
	}
}
