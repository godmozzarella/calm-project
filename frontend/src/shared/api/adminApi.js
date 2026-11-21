import { http } from './httpClient'

export const adminApi = {
  getAttackCounts: (from, to, timezone) => {
    const query = new URLSearchParams({ to, timezone })
    if (from !== null) query.set('from', from)
    return http.get(`/admin/stats/attacks?${query}`)
  },

  // ── Пользователи ──
  listUsers: q => http.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  changeRole: (id, role) => http.patch(`/admin/users/${id}/role`, { role }),
  deleteUser: id => http.delete(`/admin/users/${id}`),
  getSharedModelParticipation: id => http.get(`/admin/users/${id}/shared-model-participation`),
  setSharedModelParticipationBlocked: (id, blocked) =>
    http.patch(`/admin/users/${id}/shared-model-participation`, { blocked }),

  // ── Справочники ──
  createEntry: ({ type, value, label, order }) =>
    http.post('/admin/dictionaries', { type, value, label, order }),
  updateEntry: (id, { label, order }) =>
    http.patch(`/admin/dictionaries/${id}`, { label, order }),
  deleteEntry: id => http.delete(`/admin/dictionaries/${id}`),

  // ── Системные настройки ──
  getSettings:    () => http.get('/admin/settings'),
  updateSettings: patch => http.patch('/admin/settings', patch),

  // ── Email-рассылка ──
  getBroadcastAudience: () => http.get('/admin/broadcast/audience'),
  sendBroadcast: request => http.post('/admin/broadcast', request),
}
