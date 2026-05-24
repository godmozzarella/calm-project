package com.calm.feature.attack.dto;

import com.calm.feature.attack.AttackType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

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
		Set<String> symptoms,
		Set<String> triggers,
		Map<String, String> painZones,
		String note
) {}
