import { http } from './httpClient'
import { emit, MEDICATIONS_CHANGED } from '@/shared/lib/dataEvents'

const notify = result => { emit(MEDICATIONS_CHANGED); return result }

export const medicationApi = {
  getByDate:     date           => http.get(`/medications?from=${date}&to=${date}`),
  getAll:        ()             => http.get('/medications'),
  getInRange:    (from, to)     => http.get(`/medications?from=${from}&to=${to}`),
  getOveruseDays: (year, month) => http.get(`/medications/overuse?year=${year}&month=${month}`)
                                      .then(r => r.days),

  add: med => http.post('/medications', med).then(notify),

  update: (id, med) => http.put(`/medications/${id}`, {
    name:             med.name,
    dosage:           med.dosage           ?? null,
    category:         med.category         ?? null,
    date:             med.date,
    time:             med.time,
    attackId:         med.attackId         ?? null,
    effectiveness:    med.effectiveness    ?? null,
    therapeuticClass: med.therapeuticClass ?? null,
    purpose:          med.purpose          ?? null,
    note:             med.note             ?? '',
  }).then(notify),

  delete: id => http.delete(`/medications/${id}`).then(notify),
}
