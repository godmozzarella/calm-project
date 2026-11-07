package com.calm.feature.questionnaire;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface CycleMarkerRepository extends MongoRepository<CycleMarker, String> {
    List<CycleMarker> findByUserIdOrderByDateAsc(String userId);
    long deleteByUserId(String userId);
}
