import { useState } from 'react'
import { medicationApi } from '@/shared/api'
import { generateId } from '@/shared/lib/generateId'
import { intakeMembers, planIntakeUpdate } from './intakeEditor'

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const makeMeta = date => ({ date, time: nowTime(), attackId: null, note: '' })
const itemKey  = item => `${item.category}::${item.name}`

export const useAddMedication = ({ date, onSuccess }) => {
  const [open,     setOpen]      = useState(false)
  const [step,     setStep]      = useState(1)
  const [selected, setSelected]  = useState([])
  const [meta,     setMetaState] = useState(() => makeMeta(date))
  const [error,    setError]     = useState('')
  const [loading,  setLoading]   = useState(false)
  const [editingIntake, setEditingIntake] = useState(null)
  const [draftIntakeId, setDraftIntakeId] = useState(null)

  const openForm  = () => { setEditingIntake(null); setDraftIntakeId(generateId()); setStep(1); setSelected([]); setMetaState(makeMeta(date)); setError(''); setOpen(true) }
  const openEditForm = (med, medications) => {
    const members = intakeMembers(med, medications)
    setEditingIntake(members)
    setDraftIntakeId(med.intakeId || generateId())
    setStep(1)
    setSelected(members.map(m => ({
      sourceId: m.id,
      name: m.name,
      dosage: m.dosage ?? '',
      category: m.category ?? 'Другое',
    })))
    setMetaState({ date: med.date, time: med.time?.slice(0, 5) ?? '', attackId: med.attackId, note: med.note ?? '' })
    setError('')
    setOpen(true)
  }
  const closeForm = () => setOpen(false)

  const toggleItem = item => {
    setError('')
    setSelected(prev => {
      const key = itemKey(item)
      return prev.some(s => itemKey(s) === key)
        ? prev.filter(s => itemKey(s) !== key)
        : [...prev, { name: item.name, dosage: item.dosage, category: item.category, clientId: generateId() }]
    })
  }

  const isSelected = item => selected.some(s => itemKey(s) === itemKey(item))
  const clearSelection = () => { setSelected([]); setError('') }

  const setItemDosage = (name, category, dosage) =>
    setSelected(prev =>
      prev.map(s => s.name === name && s.category === category ? { ...s, dosage } : s)
    )

  const setMetaField = (field, value) => setMetaState(prev => ({ ...prev, [field]: value }))

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
    if (!meta.time) { setError('Укажите время приёма'); return }
    if (!meta.date) { setError('Укажите дату приёма'); return }

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
      setError(`Не удалось полностью сохранить приём: ${err.message ?? 'ошибка'}. Повторите сохранение с тем же составом.`)
    } finally {
      setLoading(false)
    }
  }

  return {
    open, step, selected, meta, error, loading, editingIntake,
    openForm, openEditForm, closeForm,
    toggleItem, isSelected, clearSelection, setItemDosage,
    setMetaField, nextStep, prevStep, submit,
  }
}
