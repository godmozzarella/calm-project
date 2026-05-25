package com.calm.feature.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import java.util.Map;

/** Все поля опциональны — обновляются только переданные. */
public record UpdateSystemSettingsRequest(
		String activeProvider,
		Map<String, String> apiKeys,
		@Min(0) @Max(23) Integer morningHour,
		@Pattern(regexp = "low|medium|high", message = "riskThreshold: допустимо low|medium|high")
		String riskThreshold
) {}
