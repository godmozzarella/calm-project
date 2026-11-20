package com.calm.feature.questionnaire;

import java.time.LocalDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("cycle_question_state")
record CycleQuestionState(@Id String id, String timezone, LocalDate lastShown, LocalDate answeredOn,
        LocalDate snoozedUntil, int ignored, boolean initialShown, LocalDate acknowledgedAutoEnd,
        CyclePromptService.Question question) {

    static CycleQuestionState empty(String id, String timezone) {
        return new CycleQuestionState(id, timezone, null, null, null, 0, false, null, null);
    }

    CycleQuestionState shown(CyclePromptService.Question next, String zone, int missed) {
        return new CycleQuestionState(id, zone, next.today(), answeredOn, snoozedUntil, missed,
                initialShown || next.type() == CyclePromptService.Type.INITIAL,
                next.type() == CyclePromptService.Type.AUTO_CLOSED ? next.end() : acknowledgedAutoEnd, next);
    }

    CycleQuestionState answered(LocalDate today, LocalDate snooze, LocalDate acknowledged, boolean skip) {
        return new CycleQuestionState(id, timezone, lastShown, today, snooze, skip ? ignored + 1 : 0,
                initialShown, acknowledged, question);
    }
}
