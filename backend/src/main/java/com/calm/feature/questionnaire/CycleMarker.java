package com.calm.feature.questionnaire;

import java.time.Instant;
import java.time.LocalDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

/** Selected days and confirmed endings. START/END remain readable for older calendar entries. */
@Document("cycle_markers")
public record CycleMarker(@Id String id, @Indexed String userId,
        @Field(targetType = FieldType.STRING) LocalDate date, Kind kind, Instant recordedAt, String source) {
    public enum Kind { DAY, CLOSED, START, END }
    public CycleMarker(String id, String userId, LocalDate date, Kind kind, Instant recordedAt) {
        this(id,userId,date,kind,recordedAt,null);
    }
    public static String key(String userId, LocalDate date, Kind kind) { return userId + "_" + date + "_" + kind; }
}
