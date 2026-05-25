package com.calm.feature.dictionary;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Запись справочника. Уникальность по {@code (type, value)} — нельзя добавить
 * два «stress» в TRIGGER, но можно добавить «stress» в TRIGGER и «stress» в SYMPTOM.
 */
@Document(collection = "dictionaries")
@CompoundIndexes({
		@CompoundIndex(name = "type_value_unique", def = "{'type': 1, 'value': 1}", unique = true),
		@CompoundIndex(name = "type_order",        def = "{'type': 1, 'order': 1}")
})
public class DictionaryEntry {

	@Id
	private String id;

	private DictionaryType type;

	/** Машинный ключ (например "stress"). Используется в записях приступов. */
	private String value;

	/** Человеко-читаемое имя на русском (например "Стресс"). */
	private String label;

	/** Порядок сортировки внутри типа. Меньшее значение — выше. */
	private int order;

	/**
	 * Опциональная категория. Для MEDICATION_PRESET — терапевтический класс
	 * (triptan / nsaid / simple / opioid / preventive). Для SYMPTOM/TRIGGER не используется.
	 */
	private String category;

	@CreatedDate
	private Instant createdAt;

	public DictionaryEntry() {}

	public DictionaryEntry(DictionaryType type, String value, String label, int order) {
		this.type = type;
		this.value = value;
		this.label = label;
		this.order = order;
	}

	public DictionaryEntry(DictionaryType type, String value, String label, int order, String category) {
		this(type, value, label, order);
		this.category = category;
	}

	public String getId() { return id; }
	public void setId(String id) { this.id = id; }
	public DictionaryType getType() { return type; }
	public void setType(DictionaryType type) { this.type = type; }
	public String getValue() { return value; }
	public void setValue(String value) { this.value = value; }
	public String getLabel() { return label; }
	public void setLabel(String label) { this.label = label; }
	public int getOrder() { return order; }
	public void setOrder(int order) { this.order = order; }
	public String getCategory() { return category; }
	public void setCategory(String category) { this.category = category; }
	public Instant getCreatedAt() { return createdAt; }
	public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
