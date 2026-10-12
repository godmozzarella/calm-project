package com.calm.feature.attack;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.attack.dto.AttackRequest;
import com.calm.feature.risk.DailyOutcomeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@Service
public class AttackService {

	private final AttackRepository repo;
	private final DailyOutcomeRepository outcomeRepo;

	@Autowired
	public AttackService(AttackRepository repo, DailyOutcomeRepository outcomeRepo) {
		this.repo = repo;
		this.outcomeRepo = outcomeRepo;
	}

	/** Constructor retained for isolated service tests that do not exercise outcome labels. */
	public AttackService(AttackRepository repo) {
		this(repo, null);
	}

	public List<Attack> listForUser(String userId) {
		return repo.findByUserIdOrderByStartDateDescStartTimeDesc(userId);
	}

	public List<Attack> listInRange(String userId, LocalDate from, LocalDate to) {
		return repo.findInRange(userId, from, to);
	}

	public Attack getOwned(String userId, String id) {
		Attack a = repo.findById(id).orElseThrow(() -> new NotFoundException("Приступ не найден"));
		if (!a.getUserId().equals(userId)) throw new NotFoundException("Приступ не найден");
		return a;
	}

	public Attack create(String userId, AttackRequest req) {
		Attack a = new Attack();
		a.setUserId(userId);
		applyRequest(a, req);
		Attack saved = repo.save(a);
		clearConflictingNegative(saved);
		return saved;
	}

	public Attack update(String userId, String id, AttackRequest req) {
		Attack a = getOwned(userId, id);
		applyRequest(a, req);
		Attack saved = repo.save(a);
		clearConflictingNegative(saved);
		return saved;
	}

	public void delete(String userId, String id) {
		Attack a = getOwned(userId, id);
		repo.delete(a);
	}

	private void applyRequest(Attack a, AttackRequest req) {
		if (!req.ongoing()) {
			if (req.endDate() == null && req.endTime() != null) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите дату окончания приступа");
			}
			if (req.endDate() != null && (req.endDate().isBefore(req.startDate())
					|| (req.endDate().equals(req.startDate()) && req.endTime() != null
					&& !req.endTime().isAfter(req.startTime())))) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Окончание приступа должно быть позже начала");
			}
		}
		a.setStartDate(req.startDate());
		a.setStartTime(req.startTime());
		a.setOngoing(req.ongoing());
		a.setEndDate(req.ongoing() ? null : req.endDate());
		a.setEndTime(req.ongoing() ? null : req.endTime());
		a.setIntensity(req.intensity());
		a.setType(req.type());
		a.setSymptoms(req.symptoms() == null ? java.util.Set.of() : req.symptoms());
		a.setTriggers(req.triggers() == null ? java.util.Set.of() : req.triggers());
		a.setPainZones(req.painZones() == null ? java.util.Map.of() : req.painZones());
		a.setNote(req.note());
	}

	private void clearConflictingNegative(Attack attack) {
		if (outcomeRepo != null && attack.getStartDate() != null) {
			outcomeRepo.deleteByUserIdAndDate(attack.getUserId(), attack.getStartDate());
		}
	}
}
