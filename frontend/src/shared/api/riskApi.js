import { http } from './httpClient'

export const riskApi = {
	getByDate: date => http.get(`/risk?date=${encodeURIComponent(date)}`),
	getParticipation: () => http.get('/risk/participation'),
	joinSharedModelPilot: (consentVersion, consentDigest) =>
		http.post('/risk/participation', { consentVersion, consentDigest }),
	declineSharedModelPilot: (consentVersion, consentDigest) =>
		http.post('/risk/participation/decline', { consentVersion, consentDigest }),
	withdrawSharedModelPilot: () => http.delete('/risk/participation'),
}
