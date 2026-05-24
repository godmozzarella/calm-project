package com.calm.feature.medication.dto;

import com.calm.feature.medication.Medication;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record MedicationDto(
		String id,
		String name,
		String dosage,
		String category,
		LocalDate date,
		LocalTime time,
		String attackId,
		Integer effectiveness,
		String therapeuticClass,
		String purpose,
		String note,
		Instant createdAt
) {
	public static MedicationDto from(Medication m) {
		return new MedicationDto(
				m.getId(),
				m.getName(),
				m.getDosage(),
				m.getCategory(),
				m.getDate(),
				m.getTime(),
				m.getAttackId(),
				m.getEffectiveness(),
				m.getTherapeuticClass(),
				m.getPurpose(),
				m.getNote(),
				m.getCreatedAt()
		);
	}
}
