package com.calm.feature.questionnaire;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
public interface QuestionnaireProfileRepository extends MongoRepository<QuestionnaireProfile, String> {
    List<QuestionnaireProfile> findByTrackCycleTrue();
}
