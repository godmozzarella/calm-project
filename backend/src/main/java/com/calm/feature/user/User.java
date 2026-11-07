package com.calm.feature.user;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Document(collection = "users")
public class User {

	@Id
	private String id;

	@Indexed(unique = true)
	private String email;

	private String name;

	private String passwordHash;
	private boolean emailVerified;
	private String emailVerificationCodeHash;
	private Instant emailVerificationExpiresAt;
	private Instant emailVerificationSentAt;
	private int emailVerificationAttempts;

	/** Temporary state for a separately verified email change. */
	private String pendingEmailChangeAddress;
	private String pendingEmailChangeCodeHash;
	private Instant pendingEmailChangeExpiresAt;
	private Instant pendingEmailChangeSentAt;
	private int pendingEmailChangeAttempts;
	@Indexed(sparse = true)
	private String pendingEmailChangeCancelTokenHash;
	private Instant pendingEmailChangeCancelExpiresAt;

	/** One-time password recovery state. */
	private String passwordResetCodeHash;
	private String passwordResetTokenHash;
	private Instant passwordResetExpiresAt;
	private Instant passwordResetSentAt;
	private int passwordResetAttempts;
	/** Только регистрации, начатые после включения обязательной проверки email. */
	private boolean registrationPending;

	/** Роль доступа. Default USER, см. {@link Role}. */
	private Role role = Role.USER;

	private String avatarUrl;

	// ── Локация для прогноза головной боли ──
	private Double latitude;
	private Double longitude;
	private String city;
    private String locationMode;
    private String locationTimezone;
    private long locationVersion;
    private java.util.List<com.calm.feature.location.LocationHistoryEntry> locationHistory;

    public String getLocationMode() { return "AUTO".equals(locationMode) ? "AUTO" : "MANUAL"; }
    public void setLocationMode(String value) { locationMode = value; }
    public boolean hasLocationTimezone() { return locationTimezone != null && !locationTimezone.isBlank(); }
    public String getLocationTimezone() { return locationTimezone == null ? "UTC" : locationTimezone; }
    public void setLocationTimezone(String value) { locationTimezone = value; }
    public long getLocationVersion() { return locationVersion; }
    public void setLocationVersion(long value) { locationVersion = value; }
    public java.util.List<com.calm.feature.location.LocationHistoryEntry> getLocationHistory() {
        return locationHistory == null ? java.util.List.of() : locationHistory;
    }
    public void setLocationHistory(java.util.List<com.calm.feature.location.LocationHistoryEntry> value) { locationHistory = value; }

	/** Email-уведомления включаются только после подтверждения адреса и явного выбора пользователя. */
	private boolean notificationsEnabled;

	/** Дата последнего отправленного уведомления — защита от дублей в один день. */
	private LocalDate lastNotifiedDate;

	/** Refresh-токен (случайный UUID). null = пользователь вышел. */
	private String refreshToken;

	/** Срок действия refresh-токена. */
	private Instant refreshTokenExpiry;

	@CreatedDate
	private Instant createdAt;

	public User() {}

	public User(String email, String name, String passwordHash) {
		this.email = email;
		this.name = name;
		this.passwordHash = passwordHash;
	}

	public String getId() { return id; }
	public void setId(String id) { this.id = id; }
	public String getEmail() { return email; }
	public void setEmail(String email) { this.email = email; }
	public String getName() { return name; }
	public void setName(String name) { this.name = name; }
	public String getPasswordHash() { return passwordHash; }
	public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
	public boolean isEmailVerified() { return emailVerified; }
	public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
	public String getEmailVerificationCodeHash() { return emailVerificationCodeHash; }
	public void setEmailVerificationCodeHash(String hash) { this.emailVerificationCodeHash = hash; }
	public Instant getEmailVerificationExpiresAt() { return emailVerificationExpiresAt; }
	public void setEmailVerificationExpiresAt(Instant expiresAt) { this.emailVerificationExpiresAt = expiresAt; }
	public Instant getEmailVerificationSentAt() { return emailVerificationSentAt; }
	public void setEmailVerificationSentAt(Instant sentAt) { this.emailVerificationSentAt = sentAt; }
	public int getEmailVerificationAttempts() { return emailVerificationAttempts; }
	public void setEmailVerificationAttempts(int attempts) { this.emailVerificationAttempts = attempts; }
	public String getPendingEmailChangeAddress() { return pendingEmailChangeAddress; }
	public void setPendingEmailChangeAddress(String value) { this.pendingEmailChangeAddress = value; }
	public String getPendingEmailChangeCodeHash() { return pendingEmailChangeCodeHash; }
	public void setPendingEmailChangeCodeHash(String value) { this.pendingEmailChangeCodeHash = value; }
	public Instant getPendingEmailChangeExpiresAt() { return pendingEmailChangeExpiresAt; }
	public void setPendingEmailChangeExpiresAt(Instant value) { this.pendingEmailChangeExpiresAt = value; }
	public Instant getPendingEmailChangeSentAt() { return pendingEmailChangeSentAt; }
	public void setPendingEmailChangeSentAt(Instant value) { this.pendingEmailChangeSentAt = value; }
	public int getPendingEmailChangeAttempts() { return pendingEmailChangeAttempts; }
	public void setPendingEmailChangeAttempts(int value) { this.pendingEmailChangeAttempts = value; }
	public String getPendingEmailChangeCancelTokenHash() { return pendingEmailChangeCancelTokenHash; }
	public void setPendingEmailChangeCancelTokenHash(String value) { this.pendingEmailChangeCancelTokenHash = value; }
	public Instant getPendingEmailChangeCancelExpiresAt() { return pendingEmailChangeCancelExpiresAt; }
	public void setPendingEmailChangeCancelExpiresAt(Instant value) { this.pendingEmailChangeCancelExpiresAt = value; }
	public void clearPendingEmailChange() {
		pendingEmailChangeAddress = null;
		pendingEmailChangeCodeHash = null;
		pendingEmailChangeExpiresAt = null;
		pendingEmailChangeSentAt = null;
		pendingEmailChangeAttempts = 0;
		pendingEmailChangeCancelTokenHash = null;
		pendingEmailChangeCancelExpiresAt = null;
	}
	public String getPasswordResetTokenHash() { return passwordResetTokenHash; }
	public void setPasswordResetTokenHash(String value) { passwordResetTokenHash = value; }
	public String getPasswordResetCodeHash() { return passwordResetCodeHash; }
	public void setPasswordResetCodeHash(String value) { this.passwordResetCodeHash = value; }
	public Instant getPasswordResetExpiresAt() { return passwordResetExpiresAt; }
	public void setPasswordResetExpiresAt(Instant value) { this.passwordResetExpiresAt = value; }
	public Instant getPasswordResetSentAt() { return passwordResetSentAt; }
	public void setPasswordResetSentAt(Instant value) { this.passwordResetSentAt = value; }
	public int getPasswordResetAttempts() { return passwordResetAttempts; }
	public void setPasswordResetAttempts(int value) { this.passwordResetAttempts = value; }
	public void clearPasswordReset() {
		passwordResetCodeHash = null;
		passwordResetTokenHash = null;
		passwordResetExpiresAt = null;
		passwordResetSentAt = null;
		passwordResetAttempts = 0;
	}
	public boolean isRegistrationPending() { return registrationPending; }
	public void setRegistrationPending(boolean registrationPending) { this.registrationPending = registrationPending; }
	public String getAvatarUrl() { return avatarUrl; }
	public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

	public Role getRole() { return role == null ? Role.USER : role; }
	public void setRole(Role role) { this.role = role == null ? Role.USER : role; }

	public Double getLatitude() { return latitude; }
	public void setLatitude(Double latitude) { this.latitude = latitude; }
	public Double getLongitude() { return longitude; }
	public void setLongitude(Double longitude) { this.longitude = longitude; }
	public String getCity() { return city; }
	public void setCity(String city) { this.city = city; }
	public boolean isNotificationsEnabled() { return notificationsEnabled; }
	public void setNotificationsEnabled(boolean notificationsEnabled) { this.notificationsEnabled = notificationsEnabled; }
	public LocalDate getLastNotifiedDate() { return lastNotifiedDate; }
	public void setLastNotifiedDate(LocalDate lastNotifiedDate) { this.lastNotifiedDate = lastNotifiedDate; }

	public Instant getCreatedAt() { return createdAt; }
	public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

	public String getRefreshToken() { return refreshToken; }
	public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
	public Instant getRefreshTokenExpiry() { return refreshTokenExpiry; }
	public void setRefreshTokenExpiry(Instant refreshTokenExpiry) { this.refreshTokenExpiry = refreshTokenExpiry; }

	/** Выдаёт новый refresh-токен со сроком 30 дней и сохраняет в объекте. */
	public String rotateRefreshToken() {
		this.refreshToken = UUID.randomUUID().toString();
		this.refreshTokenExpiry = Instant.now().plusSeconds(30L * 24 * 3600);
		return this.refreshToken;
	}

	/** Готов ли пользователь к рассылке: задана локация и не отключены уведомления. */
	public boolean canReceiveForecastEmails() {
		return emailVerified && notificationsEnabled && latitude != null && longitude != null;
	}
}
