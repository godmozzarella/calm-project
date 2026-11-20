package com.calm.feature.push;

import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.util.BigIntegers;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BrowserPushServiceTest {
	@Test
	void buildsEncryptedRequestsForAppleAndChromeUsingVapid() throws Exception {
		var generator = KeyPairGenerator.getInstance("EC", new BouncyCastleProvider());
		generator.initialize(new ECGenParameterSpec("secp256r1"));
		var vapid = generator.generateKeyPair();
		var client = generator.generateKeyPair();
		var service = new BrowserPushService(encodedPublic((ECPublicKey) vapid.getPublic()),
				encode(BigIntegers.asUnsignedByteArray(32, ((ECPrivateKey) vapid.getPrivate()).getD())),
				"mailto:push@example.test");
		assertThat(service.available()).isTrue();

		String browserKey = encodedPublic((ECPublicKey) client.getPublic());
		String auth = encode(new byte[16]);
		service.validateKeys(browserKey, auth);
		for (String endpoint : new String[]{"https://web.push.apple.com/test", "https://fcm.googleapis.com/fcm/send/test"}) {
			var request = service.notificationRequest(new DevicePushSubscription("id", "user", endpoint, browserKey, auth, null),
					BrowserPushService.FORECAST_MESSAGE, java.time.Duration.ofHours(4));
			assertThat(request.uri().toString()).isEqualTo(endpoint);
			assertThat(request.method()).isEqualTo("POST");
			assertThat(request.headers().firstValue("Content-Encoding")).hasValue("aes128gcm");
			assertThat(request.headers().firstValue("Authorization").orElseThrow()).startsWith("vapid ");
			assertThat(request.bodyPublisher().orElseThrow().contentLength()).isGreaterThan(100);
		}
	}

	@Test
	void rejectsUnsupportedHostsAndSchemes() {
		for (String endpoint : new String[]{"https://127.0.0.1/test", "http://web.push.apple.com/test",
				"https://fcm.googleapis.com.example.test/fcm/send/test", "https://fcm.googleapis.com/other",
				"https://web.push.apple.com:8443/test", "https://name@web.push.apple.com/test"}) {
			assertThatThrownBy(() -> BrowserPushService.pushEndpoint(endpoint)).isInstanceOf(IllegalArgumentException.class);
		}
	}

	private static String encodedPublic(ECPublicKey key) { return encode(key.getQ().getEncoded(false)); }
	private static String encode(byte[] value) { return Base64.getUrlEncoder().withoutPadding().encodeToString(value); }
}
