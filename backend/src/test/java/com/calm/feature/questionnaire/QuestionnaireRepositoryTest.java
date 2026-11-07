package com.calm.feature.questionnaire;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.ActiveProfiles;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static com.calm.feature.questionnaire.DailyQuestionnaire.*;
@DataMongoTest
@ActiveProfiles("test")
class QuestionnaireRepositoryTest {
    @Autowired QuestionnaireRepository repo;
    @Test void storesUnknownsDatesAndImmutableInputAndRejectsLostUpdate() {
        var now=Instant.parse("2026-11-03T10:00:00Z");var day=LocalDate.of(2026,11,3);
        Map<String,Object> f=new HashMap<>();f.put("sleepMinutes",null);f.put("stress",0);f.put("alcoholYesterday",1);
        var input=new PredictionInput("after-survey-local-day-v1",5,now,now.plusSeconds(3600),f,Map.of(),null,null,null);
        var a=new Answers(Answer.NO,Answer.NO,Answer.YES,null,null,0,Answer.UNKNOWN,Answer.YES,day,null,Answer.YES);
        var first=repo.insert(new DailyQuestionnaire("round-trip-survey","u",day,"UTC",now,a,List.of(new AnswerRevision(now,a)),input,null,false,List.of(),null));
        var found=repo.findById(first.id()).orElseThrow();
        assertThat(found.prediction().features()).containsEntry("stress",0);
        assertThat(found.prediction().features().get("sleepMinutes")).isNull();
        assertThat(found.answers().cycleStart()).isEqualTo(day);
        assertThat(found.answers().alcoholYesterday()).isEqualTo(Answer.YES);
        assertThat(found.prediction().features()).containsEntry("alcoholYesterday",1);
        assertThat(found.prediction().issuedAt()).isEqualTo(now);
        assertThatThrownBy(()->repo.insert(first)).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        repo.save(new DailyQuestionnaire(first.id(),"u",day,"UTC",now,a,first.answerHistory(),input,1,true,List.of(),first.version()));
        assertThatThrownBy(()->repo.save(first)).isInstanceOf(org.springframework.dao.OptimisticLockingFailureException.class);
    }
}
