package com.calm.feature.medication.dto;

import com.calm.feature.medication.PersonalMedication;

public record PersonalMedicationDto(String id, String name) {
	public static PersonalMedicationDto from(PersonalMedication medication) {
		return new PersonalMedicationDto(medication.getId(), medication.getName());
	}
}
