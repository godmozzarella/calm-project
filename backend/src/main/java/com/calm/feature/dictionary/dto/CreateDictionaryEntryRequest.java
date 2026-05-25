package com.calm.feature.dictionary.dto;

import com.calm.feature.dictionary.DictionaryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateDictionaryEntryRequest(
		@NotNull DictionaryType type,
		@NotBlank
		@Size(min = 2, max = 40)
		@Pattern(regexp = "[a-z][a-z0-9_]*", message = "value: только латинские буквы в нижнем регистре, цифры и подчёркивание")
		String value,
		@NotBlank @Size(min = 1, max = 60) String label,
		Integer order
) {}
