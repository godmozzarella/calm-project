package com.calm.feature.admin;

import com.calm.feature.dictionary.DictionaryService;
import com.calm.feature.dictionary.dto.CreateDictionaryEntryRequest;
import com.calm.feature.dictionary.dto.DictionaryEntryDto;
import com.calm.feature.dictionary.dto.UpdateDictionaryEntryRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/dictionaries")
public class AdminDictionaryController {

	private final DictionaryService service;

	public AdminDictionaryController(DictionaryService service) {
		this.service = service;
	}

	@PostMapping
	public DictionaryEntryDto create(@Valid @RequestBody CreateDictionaryEntryRequest req) {
		return DictionaryEntryDto.from(service.create(req));
	}

	@PatchMapping("/{id}")
	public DictionaryEntryDto update(@PathVariable String id,
			@Valid @RequestBody UpdateDictionaryEntryRequest req) {
		return DictionaryEntryDto.from(service.update(id, req));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@PathVariable String id) {
		service.delete(id);
		return ResponseEntity.noContent().build();
	}
}
