package com.calm.feature.push;

import com.calm.security.AuthenticatedUser;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users/me/device-notifications")
public class DevicePushController {
	private final DevicePushSubscriptions subscriptions;
	private final BrowserPushService push;

	public DevicePushController(DevicePushSubscriptions subscriptions, BrowserPushService push) {
		this.subscriptions = subscriptions;
		this.push = push;
	}

	record SubscriptionRequest(String endpoint, Keys keys) {}
	record Keys(String p256dh, String auth) {}
	record Configuration(boolean available, String publicKey) {}
	record Status(boolean enabled) {}

	@GetMapping
	public Configuration configuration() {
		return new Configuration(push.available(), push.publicKey());
	}

	@PostMapping(value = "/status", consumes = MediaType.APPLICATION_JSON_VALUE)
	public Status status(@AuthenticationPrincipal AuthenticatedUser principal, @RequestBody SubscriptionRequest request) {
		return new Status(subscriptions.enabled(principal.getUserId(), request.endpoint()));
	}

	@PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Void> subscribe(@AuthenticationPrincipal AuthenticatedUser principal, @RequestBody SubscriptionRequest request) {
		Keys keys = request.keys();
		subscriptions.subscribe(principal.getUserId(), request.endpoint(),
				keys == null ? null : keys.p256dh(), keys == null ? null : keys.auth());
		return ResponseEntity.noContent().build();
	}

	@DeleteMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Void> unsubscribe(@AuthenticationPrincipal AuthenticatedUser principal, @RequestBody SubscriptionRequest request) {
		subscriptions.unsubscribe(principal.getUserId(), request.endpoint());
		return ResponseEntity.noContent().build();
	}
}
