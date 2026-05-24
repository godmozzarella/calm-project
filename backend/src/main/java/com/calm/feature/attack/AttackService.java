package com.calm.feature.attack;

import com.calm.common.exception.NotFoundException;
import com.calm.feature.attack.dto.AttackRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class AttackService {

	private final AttackRepository repo;

	public AttackService(AttackRepository repo) {
		this.repo = repo;
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
		return repo.save(a);
	}

	public Attack update(String userId, String id, AttackRequest req) {
		Attack a = getOwned(userId, id);
		applyRequest(a, req);
		return repo.save(a);
	}

	public void delete(String userId, String id) {
		Attack a = getOwned(userId, id);
		repo.delete(a);
	}

	private void applyRequest(Attack a, AttackRequest req) {
		a.setStartDate(req.startDate());
		a.setStartTime(req.startTime());
		a.setOngoing(req.ongoing());
		a.setEndDate(req.ongoing() ? null : req.endDate());
		a.setEndTime(req.ongoing() ? null : req.endTime());
		a.setIntensity(req.intensity());
		a.setType(req.type());
		if (req.symptoms() != null) a.setSymptoms(req.symptoms());
		if (req.triggers() != null) a.setTriggers(req.triggers());
		if (req.painZones() != null) a.setPainZones(req.painZones());
		a.setNote(req.note());
	}
}
