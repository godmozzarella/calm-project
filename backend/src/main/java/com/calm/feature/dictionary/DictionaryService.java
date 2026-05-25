package com.calm.feature.dictionary;

import com.calm.common.exception.ConflictException;
import com.calm.common.exception.NotFoundException;
import com.calm.feature.dictionary.dto.CreateDictionaryEntryRequest;
import com.calm.feature.dictionary.dto.UpdateDictionaryEntryRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DictionaryService {

	private final DictionaryRepository repo;

	public DictionaryService(DictionaryRepository repo) {
		this.repo = repo;
	}

	public List<DictionaryEntry> listByType(DictionaryType type) {
		return repo.findByTypeOrderByOrderAscLabelAsc(type);
	}

	public DictionaryEntry create(CreateDictionaryEntryRequest req) {
		if (repo.existsByTypeAndValue(req.type(), req.value())) {
			throw new ConflictException("Запись с таким value уже существует в этом справочнике");
		}
		int order = req.order() != null ? req.order() : nextOrder(req.type());
		DictionaryEntry entry = new DictionaryEntry(req.type(), req.value(), req.label(), order, req.category());
		return repo.save(entry);
	}

	public DictionaryEntry update(String id, UpdateDictionaryEntryRequest req) {
		DictionaryEntry entry = repo.findById(id)
				.orElseThrow(() -> new NotFoundException("Запись справочника не найдена"));
		if (req.label() != null) entry.setLabel(req.label());
		if (req.order() != null) entry.setOrder(req.order());
		if (req.category() != null) entry.setCategory(req.category().isBlank() ? null : req.category());
		return repo.save(entry);
	}

	public void delete(String id) {
		if (!repo.existsById(id)) {
			throw new NotFoundException("Запись справочника не найдена");
		}
		repo.deleteById(id);
	}

	private int nextOrder(DictionaryType type) {
		return (int) repo.countByType(type) * 10 + 10;
	}
}
