import { useRef, useState } from 'react'

import SleepWheel from '@/widgets/daily-questionnaire/SleepWheel'

import s from './AddAttackForm.module.scss'

const parseTime = value => {
	const match = /^(\d{1,2}):(\d{1,2})/.exec(value || '')
	return { hours: match?.[1] ?? '', minutes: match?.[2] ?? '' }
}

const pad = value => String(value).padStart(2, '0')
const validPart = (value, max) => /^\d{1,2}$/.test(value) && Number(value) <= max

const AttackTimeWheels = ({ label, value, onChange, latestTime = null }) => {
	const [parts, setParts] = useState(() => parseTime(value))
	const partsRef = useRef(parts)
	const now = useState(() => new Date())[0]
	const initialHours = now.getHours()
	const initialMinutes = now.getMinutes()
	const maxHours = latestTime ? Number(latestTime.slice(0, 2)) : 23
	const maxMinutes = latestTime && Number(parts.hours) === maxHours ? Number(latestTime.slice(3, 5)) : 59

	const update = (part, next) => {
		const other = part === 'hours' ? 'minutes' : 'hours'
		const updated = { ...partsRef.current, [part]: next }
		if (next !== '' && updated[other] === '') updated[other] = String(other === 'hours' ? initialHours : initialMinutes)
		const minuteLimit = latestTime && Number(updated.hours) === maxHours ? Number(latestTime.slice(3, 5)) : 59
		if (part === 'hours' && validPart(updated.hours, maxHours) && Number(updated.minutes) > minuteLimit) updated.minutes = String(minuteLimit)
		partsRef.current = updated
		setParts(updated)
		onChange(validPart(updated.hours, maxHours) && validPart(updated.minutes, minuteLimit) ? `${pad(updated.hours)}:${pad(updated.minutes)}` : '')
	}

	return <div className={s.timeWheels} aria-label={label}>
		<SleepWheel label={`${label}: часы`} unit="часы" min={0} max={maxHours} initial={initialHours} value={parts.hours} onChange={hours => update('hours', hours)} />
		<span className={s.timeSeparator} aria-hidden="true">:</span>
		<SleepWheel label={`${label}: минуты`} unit="минуты" min={0} max={maxMinutes} initial={initialMinutes} value={parts.minutes} onChange={minutes => update('minutes', minutes)} />
	</div>
}

export default AttackTimeWheels
