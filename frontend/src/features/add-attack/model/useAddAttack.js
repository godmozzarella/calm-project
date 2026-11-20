import { useState, useRef } from 'react'
import { attackApi } from '@/shared/api'
import { isFutureLocalMinute, localMinute } from '@/shared/lib/localMinute'
import { notifyRequestError } from '@/shared/lib/notifyError'

const makeEmpty = date => {
  const { time: startTime } = localMinute()
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
  const pending = useRef(false)
  const [editingId, setEditingId] = useState(null)
  const [wasOngoing, setWasOngoing] = useState(false)

  const openForm = (initial = {}) => {
    if (pending.current) return
    const empty = makeEmpty(typeof initial.startDate === 'string' ? initial.startDate : date)
    if (initial.requireStartTime) empty.startTime = ''
    if (initial.ongoing === true) empty.ongoing = true
    setEditingId(null); setWasOngoing(false)
    setForm(empty); setError(''); setOpen(true)
  }
  const openEditForm = attack => {
    if (pending.current) return
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

  const setField = (field, value) => {
    setError('')
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'ongoing' && prev.ongoing && !value && !prev.endTime) {
        const { date, time } = localMinute()
        return { ...next, endDate: date, endTime: time }
      }
      if (field === 'startDate' || field === 'endDate') {
        const { date, time } = localMinute()
        if (next.startDate === date && next.startTime > time) next.startTime = time
        if (next.endDate === date && next.endTime > time) next.endTime = time
      }
      return next
    })
  }

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
    if (!form.startTime) { setError({ field: 'startTime', message: 'Укажите время начала' }); return }

    const current = localMinute()

    if (isFutureLocalMinute(form.startDate, form.startTime, current)) {
      setError({ field: 'startDate', message: 'Начало не может быть в будущем' }); return
    }
    if (!form.ongoing && (!form.endDate || form.endDate < form.startDate)) {
      setError({ field: 'endDate', message: 'Укажите дату конца не раньше начала' }); return
    }
    if (wasOngoing && !form.ongoing && !form.endTime) {
      setError({ field: 'endTime', message: 'Укажите время окончания приступа' }); return
    }
    if (!form.ongoing && form.endDate && form.endTime) {
      if (isFutureLocalMinute(form.endDate, form.endTime, current)) {
        setError({ field: 'endTime', message: 'Конец не может быть в будущем' }); return
      }
      if (`${form.endDate}T${form.endTime}` < `${form.startDate}T${form.startTime}`) {
        setError({ field: 'endTime', message: 'Время окончания не может быть раньше начала' }); return
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
      if (err.fieldValidation) {
        const field = err.fieldValidation[0]?.split(':')[0]
        setError({ field, message: 'Проверьте значение этого поля.' })
      }
      else notifyRequestError(err, 'Не удалось сохранить приступ')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  const remove = async () => {
    if (!editingId || pending.current) return
    pending.current = true
    setDeleting(true)
    setError('')
    try {
      await attackApi.delete(editingId)
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      notifyRequestError(err, 'Не удалось удалить приступ')
    } finally {
      pending.current = false
      setDeleting(false)
    }
  }

  return { open, form, error, loading, deleting, editingId, openForm, openEditForm, closeForm, setField, toggleArrayField, submit, remove }
}
