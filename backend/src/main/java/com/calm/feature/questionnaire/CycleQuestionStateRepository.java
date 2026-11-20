package com.calm.feature.questionnaire;

import org.springframework.data.mongodb.repository.MongoRepository;

interface CycleQuestionStateRepository extends MongoRepository<CycleQuestionState, String> {}
