package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface OnsetLabelRepository extends MongoRepository<OnsetDailyLabel, String> {
    List<OnsetDailyLabel> findByUserId(String userId);
    long deleteByUserId(String userId);
}
