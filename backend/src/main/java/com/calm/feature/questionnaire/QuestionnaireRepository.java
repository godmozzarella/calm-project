package com.calm.feature.questionnaire;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
public interface QuestionnaireRepository extends MongoRepository<DailyQuestionnaire, String> {
    List<DailyQuestionnaire> findByUserId(String userId);
    @Query(value = "{ 'userId': ?0 }", fields = "{ 'date': 1, '_id': 0 }", sort = "{ 'date': 1 }")
    List<CompletedDate> findCompletedDates(String userId);
    long deleteByUserId(String userId);

    record CompletedDate(LocalDate date) {}
}
