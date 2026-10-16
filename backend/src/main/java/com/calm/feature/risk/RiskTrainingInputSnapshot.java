package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/** Признаки, зафиксированные до начала целевого дня для офлайн-обучения. */
@Document(collection = "risk_training_input_snapshots")
@CompoundIndex(name = "user_target_unique", def = "{'userId': 1, 'targetDate': 1}", unique = true)
public class RiskTrainingInputSnapshot {
	@Id private String id;
	private String userId;
	private LocalDate targetDate;
	private Instant capturedAt;
	private String timezone;
	private String locationKey;
	private int baselineScore;
	private RiskLevel baselineLevel;
	private int featureSchemaVersion;
	private String scoringVersion;
	private RiskFeatureSnapshot features;
	private TrainingHistoryDetails historyDetails;

	public RiskTrainingInputSnapshot() {}

	public RiskTrainingInputSnapshot(String userId, LocalDate targetDate, Instant capturedAt,
			String timezone, String locationKey, int baselineScore, RiskLevel baselineLevel,
			int featureSchemaVersion, String scoringVersion, RiskFeatureSnapshot features,
			TrainingHistoryDetails historyDetails) {
		this.userId = userId;
		this.targetDate = targetDate;
		this.capturedAt = capturedAt;
		this.timezone = timezone;
		this.locationKey = locationKey;
		this.baselineScore = baselineScore;
		this.baselineLevel = baselineLevel;
		this.featureSchemaVersion = featureSchemaVersion;
		this.scoringVersion = scoringVersion;
		this.features = features;
		this.historyDetails = historyDetails;
	}

	public String getId() { return id; }
	void setId(String id) { this.id = id; }
	public String getUserId() { return userId; }
	public LocalDate getTargetDate() { return targetDate; }
	public Instant getCapturedAt() { return capturedAt; }
	public String getTimezone() { return timezone; }
	public String getLocationKey() { return locationKey; }
	public int getBaselineScore() { return baselineScore; }
	public RiskLevel getBaselineLevel() { return baselineLevel; }
	public int getFeatureSchemaVersion() { return featureSchemaVersion; }
	public String getScoringVersion() { return scoringVersion; }
	public RiskFeatureSnapshot getFeatures() { return features; }
	public TrainingHistoryDetails getHistoryDetails() { return historyDetails; }
}
