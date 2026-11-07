package com.calm.feature.risk;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface OnsetInputRepository extends MongoRepository<OnsetInputSnapshot, String> {
    List<OnsetInputSnapshot> findByUserId(String userId);
    long deleteByUserId(String userId);
}
