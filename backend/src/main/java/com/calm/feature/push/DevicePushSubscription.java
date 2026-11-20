package com.calm.feature.push;

import java.time.LocalDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("device_push_subscriptions")
public record DevicePushSubscription(
		@Id String id,
		@Indexed String userId,
		String endpoint,
		String p256dh,
		String auth,
		LocalDate lastDispatchDate
) {}
