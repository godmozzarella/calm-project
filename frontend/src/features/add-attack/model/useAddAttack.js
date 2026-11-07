import { useState, useRef } from 'react'
import { attackApi } from '@/shared/api'
import { isCentralError } from '@/shared/lib/isCentralError'

const now = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const makeEmpty = date => {
  const startTime = now()
  return {
    intensity: 5,
    type: 'pulsating',
    startDate: date,
    startTime,
    endDate: date,
    endTime: startTime,
		ongoing: true,
    symptoms: [],
    triggers: [],
    note: '',
  }
}

export const useAddAttack = ({ date, onSuccess }) => {
  const [open,    setOpen]    = useState(false)
  const [form,    setForm]    = useState(() => makeEmpty(date))
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const pending = useRef(false)
  const [editingId, setEditingId] = useState(null)
  const [wasOngoing, setWasOngoing] = useState(false)

  const openForm = (initial = {}) => {
    if (pending.current) return
    const empty = makeEmpty(typeof initial.startDate === 'string' ? initial.startDate : date)
    if (initial.requireStartTime) empty.startTime = ''
    if (initial.ongoing === true) empty.ongoing = true
    setDeleteError(''); setEditingId(null); setWasOngoing(false)
    setForm(empty); setError(''); setOpen(true)
  }
  const openEditForm = attack => {
    if (pending.current) return
    setDeleteError('')
    setEditingId(attack.id)
    setWasOngoing(attack.ongoing)
    setForm({
      intensity: attack.intensity,
      type: String(attack.type ?? '').toLowerCase(),
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
  const closeForm = () => { if (!pending.current) setOpen(false) }

  const setField = (field, value) => setForm(prev => {
    const next = { ...prev, [field]: value }
    if (field === 'startDate' || field === 'endDate') {
      const current = new Date()
      const day = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      const time = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`
      if (next.startDate === day && next.startTime > time) next.startTime = time
      if (next.endDate === day && next.endTime > time) next.endTime = time
    }
    return next
  })

  const toggleArrayField = (field, value) =>
    setForm(prev => {
      const list = prev[field]
      return {
        ...prev,
        [field]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
      }
    })

  const submit = async () => {
    if (pending.current) return
    setDeleteError('')
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
      if (`${form.endDate}T${form.endTime}` < `${form.startDate}T${form.startTime}`) {
        setError('Время окончания не может быть раньше начала'); return
      }
    }

    pending.current = true
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
      const saved = editingId ? await attackApi.update(editingId, payload) : await attackApi.add(payload)
      setOpen(false)
      onSuccess?.(saved)
    } catch (err) {
      if (!isCentralError(err)) setError(err.message ?? 'Ошибка сохранения')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  const remove = async () => {
    if (!editingId || pending.current) return
    pending.current = true
    setDeleting(true)
    setDeleteError('')
    setError('')
    try {
      await attackApi.delete(editingId)
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      if (!isCentralError(err)) setDeleteError(err.message || 'Не удалось удалить приступ. Попробуйте ещё раз.')
    } finally {
      pending.current = false
      setDeleting(false)
    }
  }

  return { open, form, error, deleteError, loading, deleting, editingId, openForm, openEditForm, closeForm, setField, toggleArrayField, submit, remove }
}
