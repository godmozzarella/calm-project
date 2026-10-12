package com.calm.feature.risk;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Текущее решение пользователя и журнал явных согласий/отзывов. */
@Document(collection = "risk_model_participation")
@CompoundIndex(name = "participant_user_unique", def = "{'userId': 1}", unique = true)
public class SharedModelParticipation {
	@Id
	private String id;
	private String userId;
	private boolean participating;
	private boolean adminBlocked;
	private String consentVersion;
	private String consentDigest;
	private Instant updatedAt;
	private List<ParticipationEvent> events = new ArrayList<>();

	public SharedModelParticipation() {}

	public SharedModelParticipation(String userId) {
		this.userId = userId;
	}

	public void grant(String version, String digest, Instant at) {
		if (adminBlocked) throw new IllegalStateException("Participation is blocked by an administrator");
		if (participating && version.equals(consentVersion) && digest.equals(consentDigest)) return;
		String action = participating ? "RECONSENTED" : "GRANTED";
		this.participating = true;
		this.consentVersion = version;
		this.consentDigest = digest;
		this.updatedAt = at;
		this.events.add(new ParticipationEvent(action, version, digest, at));
	}

	public void setAdminBlocked(boolean blocked, String actorUserId, Instant at) {
		if (this.adminBlocked == blocked) return;
		this.adminBlocked = blocked;
		this.updatedAt = at;
		if (blocked) {
			this.participating = false;
			this.events.add(new ParticipationEvent("ADMIN_BLOCKED", consentVersion, consentDigest, at, actorUserId));
		} else {
			this.events.add(new ParticipationEvent("ADMIN_UNBLOCKED", null, null, at, actorUserId));
		}
	}

	public void withdraw(Instant at) {
		if (!participating) return;
		this.participating = false;
		this.updatedAt = at;
		this.events.add(new ParticipationEvent("WITHDRAWN", consentVersion, consentDigest, at));
	}

	public void decline(String offeredVersion, String offeredDigest, Instant at) {
		if (participating) throw new IllegalStateException("A participant cannot decline while participating");
		if (!events.isEmpty()) {
			ParticipationEvent last = events.get(events.size() - 1);
			if ("DECLINED".equals(last.action()) && offeredVersion.equals(last.consentVersion()) &&
				offeredDigest.equals(last.consentDigest())) return;
		}
		this.updatedAt = at;
		this.events.add(new ParticipationEvent("DECLINED", offeredVersion, offeredDigest, at));
	}

	public boolean needsConsentPrompt(String currentVersion, String currentDigest) {
		if (adminBlocked) return false;
		if (participating) return !currentVersion.equals(consentVersion) || !currentDigest.equals(consentDigest);
		if (events.isEmpty()) return true;
		ParticipationEvent last = events.get(events.size() - 1);
		if ("ADMIN_UNBLOCKED".equals(last.action())) return true;
		return !currentVersion.equals(last.consentVersion()) || !currentDigest.equals(last.consentDigest());
	}

	public String getId() { return id; }
	public String getUserId() { return userId; }
	public boolean isParticipating() { return participating; }
	public boolean isAdminBlocked() { return adminBlocked; }
	public String getConsentVersion() { return consentVersion; }
	public String getConsentDigest() { return consentDigest; }
	public Instant getUpdatedAt() { return updatedAt; }
	public List<ParticipationEvent> getEvents() { return events; }

	public record ParticipationEvent(String action, String consentVersion, String consentDigest, Instant occurredAt,
			String actorUserId) {
		public ParticipationEvent(String action, String consentVersion, String consentDigest, Instant occurredAt) {
			this(action, consentVersion, consentDigest, occurredAt, null);
		}
	}
}
