import { useState } from 'react'
import { attackApi } from '@/shared/api'

const now = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const makeEmpty = date => ({
  intensity: 5,
  type: 'pulsating',
  startDate: date,
  startTime: now(),
  endDate: date,
  endTime: '',
  ongoing: false,
  symptoms: [],
  triggers: [],
  note: '',
})

export const useAddAttack = ({ date, onSuccess }) => {
  const [open,    setOpen]    = useState(false)
  const [form,    setForm]    = useState(() => makeEmpty(date))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [wasOngoing, setWasOngoing] = useState(false)

  const openForm  = () => { setEditingId(null); setWasOngoing(false); setForm(makeEmpty(date)); setError(''); setOpen(true) }
  const openEditForm = attack => {
    setEditingId(attack.id)
    setWasOngoing(attack.ongoing)
    setForm({
      intensity: attack.intensity,
      type: attack.type,
      startDate: attack.startDate,
      startTime: attack.startTime?.slice(0, 5) ?? '',
      endDate: attack.endDate ?? attack.startDate,
      endTime: attack.endTime?.slice(0, 5) ?? '',
      ongoing: attack.ongoing,
      symptoms: [...(attack.symptoms ?? [])],
      triggers: [...(attack.triggers ?? [])],
      painZones: attack.painZones ?? {},
      note: attack.note ?? '',
    })
    setError('')
    setOpen(true)
  }
  const closeForm = () => setOpen(false)

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const toggleArrayField = (field, value) =>
    setForm(prev => {
      const list = prev[field]
      return {
        ...prev,
        [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      }
    })

  const submit = async () => {
    if (!form.startTime) { setError('Укажите время начала'); return }

    const nowDate  = new Date()
    const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`
    const nowStr   = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`

    if (form.startDate > todayStr || (form.startDate === todayStr && form.startTime > nowStr)) {
      setError('Начало не может быть в будущем'); return
    }
    if (!form.ongoing && (!form.endDate || form.endDate < form.startDate)) {
      setError('Укажите дату конца не раньше начала'); return
    }
    if (wasOngoing && !form.ongoing && !form.endTime) {
      setError('Укажите время окончания приступа'); return
    }
    if (!form.ongoing && form.endDate && form.endTime) {
      if (form.endDate > todayStr || (form.endDate === todayStr && form.endTime > nowStr)) {
        setError('Конец не может быть в будущем'); return
      }
      if (`${form.endDate}T${form.endTime}` <= `${form.startDate}T${form.startTime}`) {
        setError('Время конца должно быть позже начала'); return
      }
    }

    setLoading(true)
    try {
      const payload = {
        startDate: form.startDate,
        startTime: form.startTime,
        endDate:   form.ongoing ? null : (form.endDate || form.startDate),
        endTime:   form.ongoing ? null : (form.endTime || null),
        ongoing:   form.ongoing,
        intensity: form.intensity,
        type:      form.type,
        symptoms:  form.symptoms,
        triggers:  form.triggers,
        painZones: form.painZones ?? {},
        note:      form.note.trim(),
      }
      if (editingId) await attackApi.update(editingId, payload)
      else await attackApi.add(payload)
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setError(err.message ?? 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return { open, form, error, loading, editingId, openForm, openEditForm, closeForm, setField, toggleArrayField, submit }
}
