import { http } from './httpClient'

const pending = new Map()

export const statsApi = {
  getSummary: (period = 'month') => {
    if (pending.has(period)) return pending.get(period)
    const request = http.get(`/stats?period=${period}`).finally(() => pending.delete(period))
    pending.set(period, request)
    return request
  },
}
