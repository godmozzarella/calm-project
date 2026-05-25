package com.calm.feature.dictionary;

import com.calm.feature.dictionary.dto.DictionaryEntryDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Публичный эндпоинт справочников. Используется фронтовыми формами
 * (добавление приступа, препарата) для получения списков симптомов/триггеров.
 */
@RestController
@RequestMapping("/dictionaries")
public class DictionaryController {

	private final DictionaryService service;

	public DictionaryController(DictionaryService service) {
		this.service = service;
	}

	@GetMapping
	public List<DictionaryEntryDto> list(@RequestParam DictionaryType type) {
		return service.listByType(type).stream().map(DictionaryEntryDto::from).toList();
	}
}
