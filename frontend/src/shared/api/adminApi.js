import { http } from './httpClient'

export const adminApi = {
  // ── Пользователи ──
  listUsers: q => http.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  changeRole: (id, role) => http.patch(`/admin/users/${id}/role`, { role }),

  // ── Справочники ──
  createEntry: ({ type, value, label, order }) =>
    http.post('/admin/dictionaries', { type, value, label, order }),
  updateEntry: (id, { label, order }) =>
    http.patch(`/admin/dictionaries/${id}`, { label, order }),
  deleteEntry: id => http.delete(`/admin/dictionaries/${id}`),
}
