package com.calm.feature.push;

import com.calm.feature.risk.AccountDeletedEvent;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DevicePushSubscriptions {
	private final MongoTemplate mongo;
	private final BrowserPushService push;

	public DevicePushSubscriptions(MongoTemplate mongo, BrowserPushService push) {
		this.mongo = mongo;
		this.push = push;
	}

	boolean enabled(String userId, String endpoint) {
		return mongo.exists(owned(userId, endpoint), DevicePushSubscription.class);
	}

	void subscribe(String userId, String endpoint, String p256dh, String auth) {
		if (!push.available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Push-уведомления пока недоступны");
		String id = endpointId(endpoint);
		try {
			push.validateKeys(p256dh, auth);
		} catch (GeneralSecurityException | IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Не удалось проверить подписку браузера");
		}

		DevicePushSubscription existing = mongo.findById(id, DevicePushSubscription.class);
		if (existing != null && !existing.userId().equals(userId) && !existing.auth().equals(auth)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Устройство уже использует другую подписку");
		}
		if ((existing == null || !existing.userId().equals(userId)) && mongo.count(
				Query.query(Criteria.where("userId").is(userId)), DevicePushSubscription.class) >= 20) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Достигнут предел подписок. Отключите уведомления на другом устройстве.");
		}
		// An explicit opt-in on a shared browser moves its subscription to the current account.
		if (existing == null) {
			try {
				mongo.insert(new DevicePushSubscription(id, userId, endpoint, p256dh, auth, null));
			} catch (DuplicateKeyException e) {
				throw subscriptionChanged();
			}
			return;
		}
		// Keep a concurrent opt-in or unsubscribe from being overwritten by a stale request.
		if (mongo.updateFirst(Query.query(current(existing)), new Update().set("userId", userId)
				.set("p256dh", p256dh).set("auth", auth), DevicePushSubscription.class).getMatchedCount() != 1) {
			throw subscriptionChanged();
		}
	}

	void unsubscribe(String userId, String endpoint) {
		mongo.remove(owned(userId, endpoint), DevicePushSubscription.class);
	}

	@EventListener
	public void onAccountDeleted(AccountDeletedEvent event) {
		mongo.remove(Query.query(Criteria.where("userId").is(event.userId())), DevicePushSubscription.class);
	}

	public List<DevicePushSubscription> batchAfter(String cursor) {
		Query query = cursor == null ? new Query() : Query.query(Criteria.where("_id").gt(cursor));
		return mongo.find(query.with(Sort.by("_id")).limit(200), DevicePushSubscription.class);
	}

	public List<DevicePushSubscription> forUser(String userId) {
		return mongo.find(Query.query(Criteria.where("userId").is(userId)), DevicePushSubscription.class);
	}

	public boolean claim(DevicePushSubscription subscription, LocalDate date) {
		Query query = Query.query(current(subscription).and("lastDispatchDate").ne(date));
		return mongo.updateFirst(query, new Update().set("lastDispatchDate", date), DevicePushSubscription.class)
				.getModifiedCount() == 1;
	}

	public void release(DevicePushSubscription subscription, LocalDate date) {
		mongo.updateFirst(Query.query(current(subscription).and("lastDispatchDate").is(date)),
				new Update().unset("lastDispatchDate"), DevicePushSubscription.class);
	}

	public void remove(DevicePushSubscription subscription) {
		mongo.remove(Query.query(current(subscription)), DevicePushSubscription.class);
	}

	private static Criteria current(DevicePushSubscription subscription) {
		return Criteria.where("_id").is(subscription.id()).and("userId").is(subscription.userId())
				.and("p256dh").is(subscription.p256dh()).and("auth").is(subscription.auth());
	}

	private static Query owned(String userId, String endpoint) {
		return Query.query(Criteria.where("_id").is(endpointId(endpoint)).and("userId").is(userId));
	}

	private static ResponseStatusException subscriptionChanged() {
		return new ResponseStatusException(HttpStatus.CONFLICT, "Подписка устройства изменилась. Попробуйте ещё раз.");
	}

	private static String endpointId(String endpoint) {
		try {
			BrowserPushService.pushEndpoint(endpoint);
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
					.digest(endpoint.getBytes(StandardCharsets.UTF_8)));
		} catch (IllegalArgumentException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Этот браузер использует неподдерживаемую службу уведомлений");
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
