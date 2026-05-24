package com.calm.feature.medication;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Запись о приёме препарата. Маппинг 1:1 с фронтовой моделью entities/medication.
 *
 * Дополнительные поля therapeuticClass / purpose заложены для будущего, когда
 * на бэке появится нормальный справочник и MOH-метрика будет считаться правильно
 * (см. project_moh_metric_deferred). Сейчас они опциональны и игнорируются фронтом.
 */
@Document(collection = "medications")
public class Medication {

	@Id
	private String id;

	@Indexed
	private String userId;

	private String name;
	private String dosage;
	private String category;

	private LocalDate date;
	private LocalTime time;

	/** Привязка к конкретному приступу (опционально). */
	@Indexed(sparse = true)
	private String attackId;

	/** 1=не помогло, 2=частично, 3=помогло. null=не оценено. */
	private Integer effectiveness;

	/** triptan / nsaid / simple / preventive — для MOH-классификации. */
	private String therapeuticClass;

	/** acute = купирующее, preventive = курсовое. Влияет на счёт MOH-риска. */
	private String purpose;

	private String note;

	@CreatedDate
	private Instant createdAt;

	public String getId() { return id; }
	public void setId(String id) { this.id = id; }
	public String getUserId() { return userId; }
	public void setUserId(String userId) { this.userId = userId; }
	public String getName() { return name; }
	public void setName(String name) { this.name = name; }
	public String getDosage() { return dosage; }
	public void setDosage(String dosage) { this.dosage = dosage; }
	public String getCategory() { return category; }
	public void setCategory(String category) { this.category = category; }
	public LocalDate getDate() { return date; }
	public void setDate(LocalDate date) { this.date = date; }
	public LocalTime getTime() { return time; }
	public void setTime(LocalTime time) { this.time = time; }
	public String getAttackId() { return attackId; }
	public void setAttackId(String attackId) { this.attackId = attackId; }
	public Integer getEffectiveness() { return effectiveness; }
	public void setEffectiveness(Integer effectiveness) { this.effectiveness = effectiveness; }
	public String getTherapeuticClass() { return therapeuticClass; }
	public void setTherapeuticClass(String therapeuticClass) { this.therapeuticClass = therapeuticClass; }
	public String getPurpose() { return purpose; }
	public void setPurpose(String purpose) { this.purpose = purpose; }
	public String getNote() { return note; }
	public void setNote(String note) { this.note = note; }
	public Instant getCreatedAt() { return createdAt; }
	public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
