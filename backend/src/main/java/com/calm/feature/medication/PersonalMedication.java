package com.calm.feature.medication;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Название, видимое только владельцу в его личном списке препаратов. */
@Document(collection = "personal_medications")
@CompoundIndex(name = "user_name_unique", def = "{'userId': 1, 'normalizedName': 1}", unique = true)
public class PersonalMedication {
	@Id private String id;
	private String userId;
	private String name;
	private String normalizedName;
	/** Скрыт из выбора, но остаётся для названий в старых записях дневника. */
	private boolean archived;
	private Instant createdAt;

	public PersonalMedication() {}

	public PersonalMedication(String userId, String name, String normalizedName) {
		this.userId = userId;
		this.name = name;
		this.normalizedName = normalizedName;
		this.createdAt = Instant.now();
	}

	public String getId() { return id; }
	void setId(String id) { this.id = id; }
	public String getUserId() { return userId; }
	public String getName() { return name; }
	public String getNormalizedName() { return normalizedName; }
	public boolean isArchived() { return archived; }
	public void setArchived(boolean archived) { this.archived = archived; }
	public Instant getCreatedAt() { return createdAt; }
}
