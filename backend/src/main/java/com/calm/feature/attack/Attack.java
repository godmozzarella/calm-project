package com.calm.feature.attack;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Приступ головной боли. Маппинг 1:1 с фронтовой моделью из entities/attack.
 *
 * Хранение painZones: Map<zone, color>, где color ∈ {green, yellow, red}.
 * Это совпадает с тем форматом, который читают/пишут HeadFront/HeadBack.
 */
@Document(collection = "attacks")
public class Attack {

	@Id
	private String id;

	@Indexed
	private String userId;

	private LocalDate startDate;
	private LocalTime startTime;

	private LocalDate endDate;
	private LocalTime endTime;

	private boolean ongoing;

	/** Интенсивность 1..10. */
	private int intensity;

	private AttackType type;

	private Set<String> symptoms = new HashSet<>();
	private Set<String> triggers = new HashSet<>();

	private Map<String, String> painZones = new HashMap<>();

	private String note;

	@CreatedDate
	private Instant createdAt;

	public String getId() { return id; }
	public void setId(String id) { this.id = id; }
	public String getUserId() { return userId; }
	public void setUserId(String userId) { this.userId = userId; }
	public LocalDate getStartDate() { return startDate; }
	public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
	public LocalTime getStartTime() { return startTime; }
	public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
	public LocalDate getEndDate() { return endDate; }
	public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
	public LocalTime getEndTime() { return endTime; }
	public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
	public boolean isOngoing() { return ongoing; }
	public void setOngoing(boolean ongoing) { this.ongoing = ongoing; }
	public int getIntensity() { return intensity; }
	public void setIntensity(int intensity) { this.intensity = intensity; }
	public AttackType getType() { return type; }
	public void setType(AttackType type) { this.type = type; }
	public Set<String> getSymptoms() { return symptoms; }
	public void setSymptoms(Set<String> symptoms) { this.symptoms = symptoms; }
	public Set<String> getTriggers() { return triggers; }
	public void setTriggers(Set<String> triggers) { this.triggers = triggers; }
	public Map<String, String> getPainZones() { return painZones; }
	public void setPainZones(Map<String, String> painZones) { this.painZones = painZones; }
	public String getNote() { return note; }
	public void setNote(String note) { this.note = note; }
	public Instant getCreatedAt() { return createdAt; }
	public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
