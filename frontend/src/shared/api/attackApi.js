import { http } from './httpClient'
import { emit, ATTACKS_CHANGED } from '@/shared/lib/dataEvents'

const notify = result => { emit(ATTACKS_CHANGED); return result }

export const attackApi = {
  getByDate:  date           => http.get(`/attacks?from=${date}&to=${date}`),
  getAll:     ()             => http.get('/attacks'),
  getInRange: (from, to)     => http.get(`/attacks?from=${from}&to=${to}`),

  add: attack => http.post('/attacks', attack).then(notify),

  update: (id, attack) => http.put(`/attacks/${id}`, {
    startDate:  attack.startDate,
    startTime:  attack.startTime,
    endDate:    attack.endDate   ?? null,
    endTime:    attack.endTime   ?? null,
    ongoing:    attack.ongoing   ?? false,
    intensity:  attack.intensity,
    type:       attack.type,
    symptoms:   attack.symptoms  ?? [],
    triggers:   attack.triggers  ?? [],
    painZones:  attack.painZones ?? {},
    note:       attack.note      ?? '',
  }).then(notify),

  delete: id => http.delete(`/attacks/${id}`).then(notify),
}
