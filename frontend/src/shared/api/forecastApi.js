import { http } from './httpClient'

/**
 * Клиент к /forecast эндпоинтам бэка.
 *
 * - getForecast({ lat, lon })          → { provider, days: [{ date, risk, score, reasons, ... }] }
 * - geocode(query, limit?)             → [{ name, admin, country, latitude, longitude }, ...]
 *
 * Подробные пояснения по структуре см. в backend/ForecastService / ForecastDayDto.
 */
export const forecastApi = {
	getForecast: ({ lat, lon }) =>
		http.get(`/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`),

	geocode: (query, limit = 5) =>
		http.get(`/forecast/geocode?q=${encodeURIComponent(query)}&limit=${limit}`),

	reverseGeocode: ({ lat, lon }) =>
		http.get(`/forecast/reverse-geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`),

	// Принудительная отправка тестового письма себе для проверки SMTP.
	sendTestNotification: () =>
		http.post('/forecast/notify-test', {}),
}
