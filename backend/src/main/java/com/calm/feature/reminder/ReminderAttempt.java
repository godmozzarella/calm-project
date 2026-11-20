package com.calm.feature.reminder;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("reminder_attempts")
public record ReminderAttempt(@Id String id, @Indexed String userId, @Indexed(expireAfter = "0s") Instant expiresAt) {}
