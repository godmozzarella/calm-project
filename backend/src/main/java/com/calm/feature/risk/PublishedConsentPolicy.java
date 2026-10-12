package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Current server-side consent fingerprint used to fail closed in the training pipeline. */
@Document(collection = "risk_model_consent_policy")
public class PublishedConsentPolicy {
	@Id
	private String id = "current";
	private String version;
	private String digest;
	private Instant updatedAt;

	public PublishedConsentPolicy() {}

	public PublishedConsentPolicy(String version, String digest, Instant updatedAt) {
		this.id = "current";
		this.version = version;
		this.digest = digest;
		this.updatedAt = updatedAt;
	}

	public String getId() { return id; }
	public String getVersion() { return version; }
	public String getDigest() { return digest; }
	public Instant getUpdatedAt() { return updatedAt; }
}
