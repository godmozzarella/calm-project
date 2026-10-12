import { http } from './httpClient'

export const riskApi = {
	getToday: () => http.get('/risk/today'),
	getByDate: date => http.get(`/risk?date=${encodeURIComponent(date)}`),
	getQuality: () => http.get('/risk/quality'),
	getOutcome: date => http.get(`/risk/outcome?date=${encodeURIComponent(date)}`),
	confirmNoAttack: (date, timezone) => http.post('/risk/outcome/no-attack', { date, timezone }),
	clearOutcome: date => http.delete(`/risk/outcome?date=${encodeURIComponent(date)}`),
	getParticipation: () => http.get('/risk/participation'),
	joinSharedModelPilot: (consentVersion, consentDigest) =>
		http.post('/risk/participation', { consentVersion, consentDigest }),
	declineSharedModelPilot: (consentVersion, consentDigest) =>
		http.post('/risk/participation/decline', { consentVersion, consentDigest }),
	withdrawSharedModelPilot: () => http.delete('/risk/participation'),
}
