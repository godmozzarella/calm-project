package com.calm.feature.attack.dto;

import com.calm.feature.attack.AttackType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.Set;

public record AttackRequest(
		@NotNull LocalDate startDate,
		@NotNull LocalTime startTime,
		LocalDate endDate,
		LocalTime endTime,
		boolean ongoing,
		@Min(1) @Max(10) int intensity,
		@NotNull AttackType type,
		@Size(max = 30) Set<String> symptoms,
		@Size(max = 30) Set<String> triggers,
		@Size(max = 30) Map<String, String> painZones,
		@Size(max = 2000) String note
) {}
