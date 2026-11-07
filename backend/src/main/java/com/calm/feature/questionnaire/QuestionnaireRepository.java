package com.calm.feature.questionnaire;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
public interface QuestionnaireRepository extends MongoRepository<DailyQuestionnaire, String> {
    List<DailyQuestionnaire> findByUserId(String userId);
    long deleteByUserId(String userId);
}
