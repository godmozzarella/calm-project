package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Insert-only v4 inputs. Labels and later diary edits never update this document. */
@Document(collection = "risk_onset_input_snapshots")
public record OnsetInputSnapshot(@Id String id, @org.springframework.data.mongodb.core.index.Indexed String userId, @org.springframework.data.mongodb.core.mapping.Field(targetType = org.springframework.data.mongodb.core.mapping.FieldType.STRING) LocalDate targetDate,
        String timezone, Instant plannedIssueAt, Instant targetEndAt, Instant capturedAt,
        int featureSchemaVersion, String protocolVersion, String targetVersion,
        String consentVersion, String consentDigest, Map<String, Object> features,
        Map<String, Object> weatherForecast, boolean featureUsable, List<String> qualityFlags) {
    public static final String PROTOCOL = "midnight-local-v1";
    public static String key(String userId, LocalDate day) { return userId + "_" + day; }
}
