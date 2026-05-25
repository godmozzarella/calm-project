package com.calm.feature.dictionary;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface DictionaryRepository extends MongoRepository<DictionaryEntry, String> {
	List<DictionaryEntry> findByTypeOrderByOrderAscLabelAsc(DictionaryType type);
	boolean existsByTypeAndValue(DictionaryType type, String value);
	long countByType(DictionaryType type);
}
