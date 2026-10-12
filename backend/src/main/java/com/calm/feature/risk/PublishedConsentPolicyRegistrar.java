package com.calm.feature.risk;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class PublishedConsentPolicyRegistrar implements ApplicationRunner {
	private final PublishedConsentPolicyRepository repository;

	public PublishedConsentPolicyRegistrar(PublishedConsentPolicyRepository repository) {
		this.repository = repository;
	}

	@Override
	public void run(ApplicationArguments args) {
		PublishedConsentPolicy current = repository.findById("current").orElse(null);
		if (current != null && SharedModelConsentPolicy.VERSION.equals(current.getVersion()) &&
				SharedModelConsentPolicy.DIGEST.equals(current.getDigest())) return;
		repository.save(new PublishedConsentPolicy(SharedModelConsentPolicy.VERSION,
			SharedModelConsentPolicy.DIGEST, Instant.now()));
	}
}
