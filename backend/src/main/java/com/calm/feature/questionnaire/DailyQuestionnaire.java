package com.calm.feature.questionnaire;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import java.time.*;
import java.util.*;

/** Private diary entry. First prediction inputs never change when answers or outcomes are corrected. */
@Document("daily_questionnaires")
public record DailyQuestionnaire(@Id String id, @Indexed String userId,
        @Field(targetType = FieldType.STRING) LocalDate date, String timezone,
        Instant completedAt, Answers answers, List<AnswerRevision> answerHistory,
        PredictionInput prediction, Integer outcome, boolean horizonCompleted,
        List<LabelRevision> labelHistory, @Version Long version) {
    public enum Answer { YES, NO, UNKNOWN }
    public record Answers(Answer yesterday, Answer today, Answer ongoing, Integer sleepMinutes,
            Integer sleepQuality, Integer stress, Answer medicationYesterday,
            Answer menstruating, LocalDate cycleStart, Answer cycleEnded, Answer alcoholYesterday) {
        public Answers(Answer yesterday, Answer today, Answer ongoing, Integer sleepMinutes,
                Integer sleepQuality, Integer stress, Answer medicationYesterday,
                Answer menstruating, LocalDate cycleStart) {
            this(yesterday,today,ongoing,sleepMinutes,sleepQuality,stress,medicationYesterday,menstruating,cycleStart,null,Answer.UNKNOWN);
        }
        public Answers(Answer yesterday, Answer today, Answer ongoing, Integer sleepMinutes,
                Integer sleepQuality, Integer stress, Answer medicationYesterday,
                Answer menstruating, LocalDate cycleStart, Answer cycleEnded) {
            this(yesterday,today,ongoing,sleepMinutes,sleepQuality,stress,medicationYesterday,menstruating,cycleStart,cycleEnded,Answer.UNKNOWN);
        }
    }
    public record AnswerRevision(Instant changedAt, Answers answers) {}
    public record LabelRevision(Instant changedAt, Integer outcome, boolean horizonCompleted, List<String> attackIds) {}
    public record PredictionInput(String protocol, int schemaVersion, Instant issuedAt, Instant endAt,
            Map<String, Object> features, Map<String, Object> weather,
            String consentVersion, String consentDigest, Integer ruleScore) {}
    public static String key(String userId, LocalDate date) { return userId + "_" + date; }
}
