import { useState } from 'react'
import { medicationApi } from '@/shared/api'

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

  const openForm  = () => { setStep(1); setSelected([]); setMetaState(makeMeta(date)); setError(''); setOpen(true) }
  const closeForm = () => setOpen(false)

  const toggleItem = item => {
    setError('')
    setSelected(prev => {
      const key = itemKey(item)
      return prev.some(s => itemKey(s) === key)
        ? prev.filter(s => itemKey(s) !== key)
        : [...prev, { name: item.name, dosage: item.dosage, category: item.category }]
    })
  }

  const isSelected = item => selected.some(s => itemKey(s) === itemKey(item))

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
      if (empty) { setError(`Укажите дозировку для "${empty.name}"`); return }
      setError(''); setStep(3)
    }
  }

  const prevStep = () => { setError(''); setStep(s => Math.max(1, s - 1)) }

  const submit = async () => {
    if (!meta.time) { setError('Укажите время приёма'); return }

    setLoading(true)
    try {
      await Promise.all(
        selected.map(item =>
          medicationApi.add({
            name:          item.name,
            dosage:        item.dosage,
            date:          meta.date,
            time:          meta.time,
            attackId:      meta.attackId || null,
            effectiveness: null,
            note:          meta.note.trim(),
          })
        )
      )
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      setError(err.message ?? 'Ошибка сохранения')
    } finally {
      setLoading(false)
    }
  }

  return {
    open, step, selected, meta, error, loading,
    openForm, closeForm,
    toggleItem, isSelected, setItemDosage,
    setMetaField, nextStep, prevStep, submit,
  }
}
