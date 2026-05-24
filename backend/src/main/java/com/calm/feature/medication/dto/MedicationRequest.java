package com.calm.feature.medication.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record MedicationRequest(
		@NotBlank String name,
		String dosage,
		String category,
		@NotNull LocalDate date,
		@NotNull LocalTime time,
		String attackId,
		@Min(1) @Max(3) Integer effectiveness,
		String therapeuticClass,
		String purpose,
		String note
) {}
