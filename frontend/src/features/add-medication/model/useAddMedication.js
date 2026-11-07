import { useEffect, useState } from 'react'
import { medicationApi } from '@/shared/api'
import { isCentralError } from '@/shared/lib/isCentralError'
import { generateId } from '@/shared/lib/generateId'
import { isFutureLocalMinute, localMinute } from '@/shared/lib/localMinute'
import { intakeMembers, planIntakeUpdate } from './intakeEditor'
import { attacksForDate, defaultAttackId } from './attackLink.mjs'

const makeMeta = (date, attackId = null) => ({ date, time: localMinute().time, attackId, note: '' })
const itemKey  = item => `${item.category}::${item.name}`

export const useAddMedication = ({ date, attacks = [], onSuccess }) => {
  const [open,     setOpen]      = useState(false)
  const [step,     setStep]      = useState(1)
  const [selected, setSelected]  = useState([])
  const [meta,     setMetaState] = useState(() => makeMeta(date))
  const [error,    setError]     = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [loading,  setLoading]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingIntake, setEditingIntake] = useState(null)
  const [draftIntakeId, setDraftIntakeId] = useState(null)
  const [linkChoiceTouched, setLinkChoiceTouched] = useState(false)

  const openForm  = () => { setEditingIntake(null); setLinkChoiceTouched(false); setDraftIntakeId(generateId()); setStep(1); setSelected([]); setMetaState(makeMeta(date, defaultAttackId(attacks, date))); setError(''); setDeleteError(''); setOpen(true) }
  const openEditForm = (med, medications) => {
    const members = intakeMembers(med, medications)
    setEditingIntake(members)
    setLinkChoiceTouched(true)
    setDraftIntakeId(med.intakeId || generateId())
    setStep(1)
    setSelected(members.map(m => ({
      sourceId: m.id,
      name: m.name,
      personalMedicationId: m.personalMedicationId ?? null,
      dosage: m.dosage ?? '',
      category: m.category ?? 'Другое',
    })))
    setMetaState({ date: med.date, time: med.time?.slice(0, 5) ?? '', attackId: med.attackId, note: med.note ?? '' })
    setError('')
    setDeleteError('')
    setOpen(true)
  }
  const closeForm = () => setOpen(false)

  useEffect(() => {
    if (!open || editingIntake || linkChoiceTouched) return
    const preferred = defaultAttackId(attacks, meta.date)
    setMetaState(previous => previous.attackId === preferred ? previous : { ...previous, attackId: preferred })
  }, [attacks, editingIntake, linkChoiceTouched, meta.date, open])

  const toggleItem = item => {
    setError('')
    setSelected(prev => {
      const key = itemKey(item)
      return prev.some(s => itemKey(s) === key)
        ? prev.filter(s => itemKey(s) !== key)
        : [...prev, { name: item.name, personalMedicationId: item.personalMedicationId ?? null,
            dosage: item.dosage, category: item.category, clientId: generateId() }]
    })
  }

  const isSelected = item => selected.some(s => itemKey(s) === itemKey(item))
  const clearSelection = () => { setSelected([]); setError('') }

  const setItemDosage = (name, category, dosage) =>
    setSelected(prev =>
      prev.map(s => s.name === name && s.category === category ? { ...s, dosage } : s)
    )

  const setMetaField = (field, value) => {
    if (field === 'attackId') setLinkChoiceTouched(true)
    setMetaState(prev => {
      if (field !== 'date') return { ...prev, [field]: value }
      const current = localMinute()
      if (value > current.date) return prev
      const available = attacksForDate(attacks, value)
      const attackId = editingIntake || linkChoiceTouched
        ? (available.some(attack => attack.id === prev.attackId) ? prev.attackId : null)
        : defaultAttackId(attacks, value)
      const time = isFutureLocalMinute(value, prev.time, current) ? current.time : prev.time
      return { ...prev, date: value, time, attackId }
    })
  }

  const nextStep = () => {
    if (step === 1) {
      if (selected.length === 0) { setError('Выберите хотя бы один препарат'); return }
      setError(''); setStep(2)
    } else if (step === 2) {
      const empty = selected.find(s => !s.dosage?.trim())
      if (empty && !editingIntake) { setError(`Укажите дозировку для "${empty.name}"`); return }
      setError(''); setStep(3)
    }
  }

  const prevStep = () => { setError(''); setStep(s => Math.max(1, s - 1)) }

  const submit = async () => {
    if (loading || deleting) return
    if (selected.length === 0) { setError('Выберите хотя бы один препарат'); return }
    if (!meta.time) { setError('Укажите время приёма'); return }
    if (!meta.date) { setError('Укажите дату приёма'); return }
    if (isFutureLocalMinute(meta.date, meta.time)) { setError('Время приёма не может быть в будущем'); return }

    setLoading(true)
    setError('')
    try {
      if (editingIntake) {
        const { updates, creates, removes } = planIntakeUpdate(editingIntake, selected)
        const common = {
          intakeId: draftIntakeId,
          date: meta.date,
          time: meta.time,
          attackId: meta.attackId || null,
          note: meta.note.trim(),
        }
        const updateRequests = updates.map(({ original, item }) => {
          const sameMedicine = original.name === item.name &&
            (original.category ?? 'Другое') === item.category
          return {
            id: original.id,
            medication: {
              ...original,
              ...common,
              name: item.name,
              personalMedicationId: item.personalMedicationId ?? null,
              dosage: item.dosage,
              category: sameMedicine ? original.category : item.category,
              effectiveness: sameMedicine && original.dosage === item.dosage ? original.effectiveness : null,
              therapeuticClass: sameMedicine ? original.therapeuticClass : null,
              purpose: sameMedicine ? original.purpose : null,
            },
          }
        })
        const createRequests = creates.map(item => ({
            ...common,
            clientId: item.clientId,
            name: item.name,
            personalMedicationId: item.personalMedicationId ?? null,
            dosage: item.dosage,
            category: item.category,
            effectiveness: null,
        }))
        await medicationApi.saveIntake({
          updates: updateRequests,
          creates: createRequests,
          removes: removes.map(m => m.id),
        })
      } else {
        await medicationApi.saveIntake({
          creates: selected.map(item => ({
            clientId: item.clientId,
            intakeId: draftIntakeId,
            name:          item.name,
            personalMedicationId: item.personalMedicationId ?? null,
            dosage:        item.dosage,
            category:      item.category,
            date:          meta.date,
            time:          meta.time,
            attackId:      meta.attackId || null,
            effectiveness: null,
            note:          meta.note.trim(),
          })),
        })
      }
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      if (!isCentralError(err)) setError(`Не удалось полностью сохранить приём: ${err.message ?? 'ошибка'}. Повторите сохранение с тем же составом.`)
    } finally {
      setLoading(false)
    }
  }

  const remove = async () => {
    if (!editingIntake?.length || loading || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const results = await Promise.allSettled(editingIntake.map(medication => medicationApi.delete(medication.id)))
      const remaining = editingIntake.filter((_, index) => results[index].status === 'rejected')
      onSuccess?.()
      if (remaining.length) {
        setEditingIntake(remaining)
        setSelected(previous => previous.filter(item => remaining.some(medication => medication.id === item.sourceId)))
        if (!results.some(result => result.status === 'rejected' && isCentralError(result.reason))) setDeleteError(remaining.length === editingIntake.length
          ? 'Не удалось удалить приём. Попробуйте ещё раз.'
          : 'Часть препаратов удалена. Повторите удаление оставшихся.')
      } else {
        setOpen(false)
      }
    } finally {
      setDeleting(false)
    }
  }

  return {
    open, step, selected, meta, error, deleteError, loading, deleting, editingIntake,
    openForm, openEditForm, closeForm,
    toggleItem, isSelected, clearSelection, setItemDosage,
    setMetaField, nextStep, prevStep, submit, remove,
  }
}
