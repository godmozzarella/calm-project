import { http } from './httpClient'
import { emit, ATTACKS_CHANGED } from '@/shared/lib/dataEvents'

const notify = result => { emit(ATTACKS_CHANGED); return result }
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export const attackApi = {
  getByDate:  date           => http.get(`/attacks?from=${date}&to=${date}`),
  getAll:     ()             => http.get('/attacks'),
  getInRange: (from, to)     => http.get(`/attacks?from=${from}&to=${to}`),

  add: attack => http.post('/attacks', { ...attack, timezone: browserTimezone() }).then(notify),

  complete: async id => {
    // Read the latest details before saving the end, including zones and recent edits.
    const attack = await http.get(`/attacks/${id}`)
    if (!attack.ongoing) return notify(attack)
    const now = new Date()
    const pad = value => String(value).padStart(2, '0')
    return attackApi.update(id, {
      ...attack,
      ongoing: false,
      endDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      endTime: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    })
  },

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
    timezone:   browserTimezone(),
  }).then(notify),

  delete: id => http.delete(`/attacks/${id}`).then(notify),
}
