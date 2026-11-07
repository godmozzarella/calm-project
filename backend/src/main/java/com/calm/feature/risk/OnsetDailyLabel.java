package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Mutable, revisioned truth, kept separately from immutable prediction inputs. */
@Document(collection = "risk_onset_daily_labels")
public record OnsetDailyLabel(@Id String id, @org.springframework.data.mongodb.core.index.Indexed String userId, @org.springframework.data.mongodb.core.mapping.Field(targetType = org.springframework.data.mongodb.core.mapping.FieldType.STRING) LocalDate targetDate, String timezone,
        Integer outcome, Boolean headachePresent, boolean dayCompleted, Instant finalizedAt,
        String labelSource, Instant markedAt, Instant labelAvailableAt, long revision,
        List<String> matchedAttackIds, List<Revision> revisions, @Version Long lockVersion) {
    public record Revision(long revision, Instant changedAt, Integer outcome, Boolean headachePresent,
            boolean dayCompleted, String source, Instant markedAt, List<String> matchedAttackIds) {}
}
