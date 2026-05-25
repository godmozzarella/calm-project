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

	private String avatarUrl;

	// ── Локация для прогноза головной боли ──
	private Double latitude;
	private Double longitude;
	private String city;

	/** Шлём ли уведомления о неблагоприятной погоде на email. По умолчанию true после установки локации. */
	private boolean notificationsEnabled = true;

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
	public String getAvatarUrl() { return avatarUrl; }
	public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

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
		return notificationsEnabled && latitude != null && longitude != null;
	}
}
