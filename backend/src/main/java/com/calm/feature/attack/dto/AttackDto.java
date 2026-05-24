package com.calm.feature.attack.dto;

import com.calm.feature.attack.Attack;
import com.calm.feature.attack.AttackType;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.Set;

public record AttackDto(
		String id,
		LocalDate startDate,
		LocalTime startTime,
		LocalDate endDate,
		LocalTime endTime,
		boolean ongoing,
		int intensity,
		AttackType type,
		Set<String> symptoms,
		Set<String> triggers,
		Map<String, String> painZones,
		String note,
		Instant createdAt
) {
	public static AttackDto from(Attack a) {
		return new AttackDto(
				a.getId(),
				a.getStartDate(),
				a.getStartTime(),
				a.getEndDate(),
				a.getEndTime(),
				a.isOngoing(),
				a.getIntensity(),
				a.getType(),
				a.getSymptoms(),
				a.getTriggers(),
				a.getPainZones(),
				a.getNote(),
				a.getCreatedAt()
		);
	}
}
