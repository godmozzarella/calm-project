package com.calm.feature.medication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PersonalMedicationNameRequest(@NotBlank @Size(max = 120) String name) {}
