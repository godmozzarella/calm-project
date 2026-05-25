import { http } from './httpClient'

export const statsApi = {
  getSummary: (period = 'month') => http.get(`/stats?period=${period}`),
}
