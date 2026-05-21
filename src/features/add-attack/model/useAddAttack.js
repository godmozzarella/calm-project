import { useState } from 'react'
import { addAttack } from '@/entities/attack'

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
	const [open, setOpen] = useState(false)
	const [form, setForm] = useState(() => makeEmpty(date))
	const [error, setError] = useState('')

	const openForm = () => {
		setForm(makeEmpty(date))
		setError('')
		setOpen(true)
	}

	const closeForm = () => setOpen(false)

	const setField = (field, value) =>
		setForm(prev => ({ ...prev, [field]: value }))

	const toggleArrayField = (field, value) =>
		setForm(prev => {
			const list = prev[field]
			return {
				...prev,
				[field]: list.includes(value)
					? list.filter(v => v !== value)
					: [...list, value],
			}
		})

	const submit = () => {
		if (!form.startTime) {
			setError('Укажите время начала')
			return
		}
		if (!form.ongoing && form.endDate && form.endTime) {
			const start = `${form.startDate}T${form.startTime}`
			const end = `${form.endDate}T${form.endTime}`
			if (end <= start) {
				setError('Время конца должно быть позже начала')
				return
			}
		}
		addAttack({
			startDate: form.startDate,
			startTime: form.startTime,
			endDate: form.ongoing ? null : (form.endDate || form.startDate),
			endTime: form.ongoing ? null : form.endTime || null,
			ongoing: form.ongoing,
			intensity: form.intensity,
			type: form.type,
			symptoms: form.symptoms,
			triggers: form.triggers,
			note: form.note.trim(),
		})
		setOpen(false)
		onSuccess?.()
	}

	return {
		open, form, error,
		openForm, closeForm,
		setField, toggleArrayField,
		submit,
	}
}
