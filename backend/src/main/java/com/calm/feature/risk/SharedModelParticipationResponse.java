package com.calm.feature.risk;

import java.time.Instant;
import java.util.List;

public record SharedModelParticipationResponse(
		boolean participating,
		boolean adminBlocked,
		boolean enrollmentOpen,
		boolean showConsentPrompt,
		boolean consentCurrent,
		String currentConsentVersion,
		String currentConsentDigest,
		List<String> consentText,
		String consentVersion,
		Instant updatedAt
) {
	static SharedModelParticipationResponse from(SharedModelParticipation entity,
			boolean enrollmentOpen, String currentConsentVersion) {
		return new SharedModelParticipationResponse(
				entity != null && entity.isParticipating(),
				entity != null && entity.isAdminBlocked(),
				enrollmentOpen,
				enrollmentOpen && (entity == null || entity.needsConsentPrompt(currentConsentVersion,
					SharedModelConsentPolicy.DIGEST)),
				entity != null && currentConsentVersion.equals(entity.getConsentVersion()) &&
						SharedModelConsentPolicy.DIGEST.equals(entity.getConsentDigest()),
				currentConsentVersion,
				SharedModelConsentPolicy.DIGEST,
				SharedModelConsentPolicy.TEXT,
				entity == null ? null : entity.getConsentVersion(),
				entity == null ? null : entity.getUpdatedAt());
	}
}
