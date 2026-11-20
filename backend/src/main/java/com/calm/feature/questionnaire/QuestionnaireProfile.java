package com.calm.feature.questionnaire;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
@Document("questionnaire_profiles")
public record QuestionnaireProfile(@Id String id, Sex sex, Integer age, boolean trackCycle, Boolean confirmPlannedCycle) {
    public QuestionnaireProfile(String id, Sex sex, Integer age, boolean trackCycle) {
        this(id, sex, age, trackCycle, null);
    }

    public boolean confirmsPlans() { return !Boolean.FALSE.equals(confirmPlannedCycle); }
    public enum Sex { FEMALE, MALE, OTHER, UNSPECIFIED }
}
