package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/** Неизменяемая оценка, выданная до начала прогнозируемого дня. */
@Document(collection = "risk_prediction_records")
@CompoundIndex(name = "user_target_issued", def = "{'userId': 1, 'targetDate': 1, 'issuedAt': -1}")
public class RiskPredictionRecord {
	@Id
	private String id;
	private String userId;
	private LocalDate targetDate;
	private Instant issuedAt;
	private String timezone;
	private int score;
	private RiskLevel level;
	private Integer featureSchemaVersion;
	private String scoringVersion;
	private RiskFeatureSnapshot features;

	public RiskPredictionRecord() {}

	public RiskPredictionRecord(String userId, LocalDate targetDate, Instant issuedAt,
			String timezone, int score, RiskLevel level) {
		this(userId, targetDate, issuedAt, timezone, score, level, null, null, null);
	}

	public RiskPredictionRecord(String userId, LocalDate targetDate, Instant issuedAt,
			String timezone, int score, RiskLevel level, Integer featureSchemaVersion,
			String scoringVersion, RiskFeatureSnapshot features) {
		this.userId = userId;
		this.targetDate = targetDate;
		this.issuedAt = issuedAt;
		this.timezone = timezone;
		this.score = score;
		this.level = level;
		this.featureSchemaVersion = featureSchemaVersion;
		this.scoringVersion = scoringVersion;
		this.features = features;
	}

	public String getId() { return id; }
	public String getUserId() { return userId; }
	public LocalDate getTargetDate() { return targetDate; }
	public Instant getIssuedAt() { return issuedAt; }
	public String getTimezone() { return timezone; }
	public int getScore() { return score; }
	public RiskLevel getLevel() { return level; }
	public Integer getFeatureSchemaVersion() { return featureSchemaVersion; }
	public String getScoringVersion() { return scoringVersion; }
	public RiskFeatureSnapshot getFeatures() { return features; }
}
