package com.calm.feature.dictionary.dto;

import com.calm.feature.dictionary.DictionaryEntry;
import com.calm.feature.dictionary.DictionaryType;

public record DictionaryEntryDto(
		String id,
		DictionaryType type,
		String value,
		String label,
		int order
) {
	public static DictionaryEntryDto from(DictionaryEntry e) {
		return new DictionaryEntryDto(e.getId(), e.getType(), e.getValue(), e.getLabel(), e.getOrder());
	}
}
