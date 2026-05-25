package com.calm.feature.dictionary.dto;

import jakarta.validation.constraints.Size;

public record UpdateDictionaryEntryRequest(
		@Size(min = 1, max = 60) String label,
		Integer order,
		@Size(max = 32) String category
) {}
