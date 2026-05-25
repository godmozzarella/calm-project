package com.calm.feature.forecast.snapshot;

import com.calm.feature.forecast.RiskLevel;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Снимок прогноза для конкретной локации на конкретную дату.
 * Ключ {@code locationKey} — округлённые координаты (например "55.75,37.62"),
 * чтобы все пользователи из одного города шарили один снимок.
 *
 * <p>Сохраняется автоматически при каждом запросе прогноза через {@code ForecastService}.
 * Используется в статистике для корреляции «приступ ↔ погодный риск».
 */
@Document(collection = "forecast_snapshots")
@CompoundIndexes({
		@CompoundIndex(name = "location_date_unique", def = "{'locationKey': 1, 'date': 1}", unique = true)
})
public class ForecastSnapshot {

	@Id
	private String id;

	private String locationKey;
	private LocalDate date;

	private RiskLevel risk;
	private int score;
	private Double pressureHpa;
	private Double pressureDelta24h;
	private Double humidity;
	private Double tempMin;
	private Double tempMax;
	private Double windKmhMax;
	private Double kpIndex;

	@CreatedDate
	private Instant createdAt;

	public ForecastSnapshot() {}

	public String getId() { return id; }
	public void setId(String id) { this.id = id; }
	public String getLocationKey() { return locationKey; }
	public void setLocationKey(String locationKey) { this.locationKey = locationKey; }
	public LocalDate getDate() { return date; }
	public void setDate(LocalDate date) { this.date = date; }
	public RiskLevel getRisk() { return risk; }
	public void setRisk(RiskLevel risk) { this.risk = risk; }
	public int getScore() { return score; }
	public void setScore(int score) { this.score = score; }
	public Double getPressureHpa() { return pressureHpa; }
	public void setPressureHpa(Double pressureHpa) { this.pressureHpa = pressureHpa; }
	public Double getPressureDelta24h() { return pressureDelta24h; }
	public void setPressureDelta24h(Double pressureDelta24h) { this.pressureDelta24h = pressureDelta24h; }
	public Double getHumidity() { return humidity; }
	public void setHumidity(Double humidity) { this.humidity = humidity; }
	public Double getTempMin() { return tempMin; }
	public void setTempMin(Double tempMin) { this.tempMin = tempMin; }
	public Double getTempMax() { return tempMax; }
	public void setTempMax(Double tempMax) { this.tempMax = tempMax; }
	public Double getWindKmhMax() { return windKmhMax; }
	public void setWindKmhMax(Double windKmhMax) { this.windKmhMax = windKmhMax; }
	public Double getKpIndex() { return kpIndex; }
	public void setKpIndex(Double kpIndex) { this.kpIndex = kpIndex; }
	public Instant getCreatedAt() { return createdAt; }
	public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

	/** Округление координат до 2 знаков (~1 км) — общий ключ для пользователей одного города. */
	public static String makeLocationKey(double lat, double lon) {
		return String.format("%.2f,%.2f", lat, lon);
	}
}
