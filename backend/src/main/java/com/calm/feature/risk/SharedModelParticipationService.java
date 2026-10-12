package com.calm.feature.risk;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class SharedModelParticipationService {
	public static final String CONSENT_VERSION = SharedModelConsentPolicy.VERSION;

	private final SharedModelParticipationRepository repository;
	private final boolean enrollmentOpen;

	public SharedModelParticipationService(SharedModelParticipationRepository repository,
			@Value("${calm.risk-pilot.enrollment-open:false}") boolean enrollmentRequested,
			@Value("${calm.risk-pilot.approved-consent-version:}") String approvedConsentVersion,
			@Value("${calm.risk-pilot.approved-consent-digest:}") String approvedConsentDigest) {
		this.repository = repository;
		this.enrollmentOpen = enrollmentRequested && CONSENT_VERSION.equals(approvedConsentVersion) &&
				SharedModelConsentPolicy.DIGEST.equals(approvedConsentDigest);
	}

	public SharedModelParticipationResponse get(String userId) {
		return SharedModelParticipationResponse.from(repository.findByUserId(userId).orElse(null), enrollmentOpen, CONSENT_VERSION);
	}

	public SharedModelParticipationResponse grant(String userId, String acceptedConsentVersion,
			String acceptedConsentDigest) {
		if (!enrollmentOpen) throw new ResponseStatusException(HttpStatus.CONFLICT, "Набор в пилот пока закрыт");
		SharedModelParticipation participation = repository.findByUserId(userId)
				.orElseGet(() -> new SharedModelParticipation(userId));
		if (participation.isAdminBlocked()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Администратор отключил ваше участие в пилоте");
		}
		if (!CONSENT_VERSION.equals(acceptedConsentVersion) ||
				!SharedModelConsentPolicy.DIGEST.equals(acceptedConsentDigest)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Условия участия изменились. Обновите страницу и ознакомьтесь с ними снова");
		}
		participation.grant(CONSENT_VERSION, SharedModelConsentPolicy.DIGEST, Instant.now());
		return SharedModelParticipationResponse.from(repository.save(participation), enrollmentOpen, CONSENT_VERSION);
	}

	public SharedModelParticipationResponse withdraw(String userId) {
		SharedModelParticipation participation = repository.findByUserId(userId).orElse(null);
		if (participation == null) return SharedModelParticipationResponse.from(null, enrollmentOpen, CONSENT_VERSION);
		participation.withdraw(Instant.now());
		return SharedModelParticipationResponse.from(repository.save(participation), enrollmentOpen, CONSENT_VERSION);
	}

	public SharedModelParticipationResponse decline(String userId, String offeredConsentVersion,
			String offeredConsentDigest) {
		if (!enrollmentOpen) throw new ResponseStatusException(HttpStatus.CONFLICT, "Набор в пилот пока закрыт");
		SharedModelParticipation participation = repository.findByUserId(userId)
				.orElseGet(() -> new SharedModelParticipation(userId));
		if (participation.isAdminBlocked()) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Администратор отключил ваше участие в пилоте");
		}
		if (!CONSENT_VERSION.equals(offeredConsentVersion) ||
				!SharedModelConsentPolicy.DIGEST.equals(offeredConsentDigest)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"Условия участия изменились. Обновите страницу и ознакомьтесь с ними снова");
		}
		participation.decline(CONSENT_VERSION, SharedModelConsentPolicy.DIGEST, Instant.now());
		return SharedModelParticipationResponse.from(repository.save(participation), enrollmentOpen, CONSENT_VERSION);
	}

	public SharedModelParticipationResponse setAdminBlocked(String userId, String adminUserId, boolean blocked) {
		SharedModelParticipation participation = repository.findByUserId(userId)
				.orElseGet(() -> new SharedModelParticipation(userId));
		participation.setAdminBlocked(blocked, adminUserId, Instant.now());
		return SharedModelParticipationResponse.from(repository.save(participation), enrollmentOpen, CONSENT_VERSION);
	}
}
