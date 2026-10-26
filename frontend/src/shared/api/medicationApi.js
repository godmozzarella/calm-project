import { http } from './httpClient'
import { emit, MEDICATIONS_CHANGED } from '@/shared/lib/dataEvents'

const notify = result => { emit(MEDICATIONS_CHANGED); return result }

const medicationBody = med => ({
  intakeId:         med.intakeId         ?? null,
  name:             med.name,
  personalMedicationId: med.personalMedicationId ?? null,
  dosage:           med.dosage           ?? null,
  category:         med.category         ?? null,
  date:             med.date,
  time:             med.time,
  attackId:         med.attackId         ?? null,
  effectiveness:    med.effectiveness    ?? null,
  therapeuticClass: med.therapeuticClass ?? null,
  purpose:          med.purpose          ?? null,
  note:             med.note             ?? '',
})

export const medicationApi = {
  getByDate:     date           => http.get(`/medications?from=${date}&to=${date}`),
  getAll:        ()             => http.get('/medications'),
  getPersonal:   ()             => http.get('/medications/personal'),
  deletePersonal: id            => http.delete(`/medications/personal/${encodeURIComponent(id)}`),
  getInRange:    (from, to)     => http.get(`/medications?from=${from}&to=${to}`),
  getOveruseDays: (year, month) => http.get(`/medications/overuse?year=${year}&month=${month}`)
                                      .then(r => r.days),

  add: med => http.post('/medications', med).then(notify),

  update: (id, med) => http.put(`/medications/${id}`, medicationBody(med)).then(notify),

  saveIntake: async ({ updates = [], creates = [], removes = [] }) => {
    try {
      for (const { id, medication } of updates) {
        await http.put(`/medications/${id}`, medicationBody(medication))
      }
      for (const medication of creates) await http.post('/medications', medication)
      for (const id of removes) await http.delete(`/medications/${id}`)
    } finally {
      emit(MEDICATIONS_CHANGED)
    }
  },

  delete: id => http.delete(`/medications/${id}`).then(notify),
}
