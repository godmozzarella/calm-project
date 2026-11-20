import { useEffect, useRef, useState } from 'react'

import { ATTACK_TYPE_LABELS, intensityColor } from '@/entities/attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { localMinute } from '@/shared/lib/localMinute'
import { FieldError, Input } from '@/shared/ui/Input'
import { dictionaryApi } from '@/shared/api'
import CloseButton from '@/shared/ui/Button/CloseButton'
import RangeSlider from '@/shared/ui/RangeSlider/RangeSlider'
import AttackTimeWheels from './AttackTimeWheels'
import s from './AddAttackForm.module.scss'

const VALIDATION_FIELDS = new Set(['intensity', 'type', 'startDate', 'startTime', 'endDate', 'endTime', 'symptoms', 'triggers', 'note'])

const TYPES = Object.entries(ATTACK_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const AddAttackForm = ({ open, form, error, loading, deleting, editing, onClose, setField, toggleArrayField, onSubmit, onSubmitAnother, onDelete, title }) => {
	useBodyScrollLock(open)
	const sheet = useRef(null)
	const [symptoms, setSymptoms] = useState([])
	const [triggers, setTriggers] = useState([])
	const [, refreshClock] = useState(0)
	useEffect(() => {
		if (!open) return undefined
		const timer = window.setInterval(() => refreshClock(value => value + 1), 15000)
		return () => window.clearInterval(timer)
	}, [open])

	useEffect(() => {
		if (!open) return
		dictionaryApi.getByType('SYMPTOM').then(setSymptoms).catch(() => {})
		dictionaryApi.getByType('TRIGGER').then(setTriggers).catch(() => {})
	}, [open])

	useEffect(() => {
		if (!open) return
		const previous = document.activeElement
		sheet.current?.focus({ preventScroll: true })
		return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }) }
	}, [open])

	if (!open) return null

	const { date: today, time: currentTime } = localMinute()
	const busy = loading || deleting
	const fieldError = field => error?.field === field ? error.message : undefined

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()} onKeyDown={e => { if(e.key==='Escape') { e.stopPropagation(); if(!busy) onClose() } }}>
			<div ref={sheet} className={s.sheet} tabIndex={-1} aria-busy={busy} data-attack-form role="dialog" aria-modal="true" aria-label={title || (editing ? 'Редактировать приступ' : 'Новый приступ')}>
				<div className={s.handle} />

				<div className={s.header}>
					<h2 className={s.title}>{title || (editing ? 'Редактировать приступ' : 'Новый приступ')}</h2>
					<CloseButton label="Закрыть форму приступа" title="Закрыть форму записи приступа." onClick={onClose} disabled={busy} />
				</div>

				<div className={s.body}>
					{error && !VALIDATION_FIELDS.has(error.field) && <FieldError>{error.message}</FieldError>}
					{/* ── Интенсивность ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Интенсивность боли</span>
						<FieldError>{fieldError('intensity')}</FieldError>
						<div className={s.intensityRow}>
							<RangeSlider title="Сила боли от 1 до 10"
								aria-label="Сила боли от 1 до 10"
								min={1} max={10}
								value={form.intensity}
								onChange={intensity => setField('intensity', intensity)}
								className={s.slider}
							/>
							<span
								className={s.intensityValue}
								style={{ color: intensityColor(form.intensity) }}
							>
								{form.intensity}
							</span>
						</div>
						<div className={s.intensityLabels}>
							<span>Слабая</span>
							<span>Сильная</span>
						</div>
					</section>

					{/* ── Тип боли ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Тип боли</span>
						<FieldError>{fieldError('type')}</FieldError>
						<div className={s.chips}>
							{TYPES.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.type === value ? s.chipActive : ''}`}
									onClick={() => setField('type', value)}
					type="button"
					aria-pressed={form.type === value}
					title={`Выбрать тип боли «${label}» для этого приступа.`}
								>
									{label}
								</button>
							))}
						</div>
					</section>

					{/* ── Время ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Время</span>
						<div className={s.timeRow}>
							<div className={s.timeField}>
								<span>Начало</span>
								<Input
									type="date"
									aria-label="Дата начала" error={fieldError('startDate')}
									title="Укажите день, когда начался приступ."
									value={form.startDate}
									max={today}
									onChange={e => setField('startDate', e.target.value)}
								/>
								<AttackTimeWheels key={`start-${form.startDate}`} label="Время начала приступа" error={fieldError('startTime')} value={form.startTime} latestTime={form.startDate === today ? currentTime : null} onChange={value => setField('startTime', value)} />
							</div>
							{!form.ongoing && (
								<div className={s.timeField}>
									<span>Конец</span>
									<Input
										type="date"
										aria-label="Дата окончания" error={fieldError('endDate')}
										title="Укажите день, когда приступ закончился."
										value={form.endDate}
										min={form.startDate}
										max={today}
										onChange={e => setField('endDate', e.target.value)}
									/>
									<AttackTimeWheels key={`end-${form.endDate}`} label="Время окончания приступа" error={fieldError('endTime')} value={form.endTime} latestTime={form.endDate === today ? currentTime : null} onChange={value => setField('endTime', value)} />
								</div>
							)}
						</div>
						<button
							type="button"
							className={s.ongoingToggle}
							role="switch"
							aria-checked={form.ongoing}
							aria-label="Приступ продолжается"
							title="Включите, если приступ ещё не закончился. Время окончания можно будет указать позже."
							onClick={() => setField('ongoing', !form.ongoing)}
						>
							<span>Приступ продолжается</span>
							<span className={`${s.toggleTrack} ${form.ongoing ? s.toggleTrackActive : ''}`} aria-hidden="true">
								<span className={s.toggleThumb} />
							</span>
						</button>
					</section>

					{/* ── Симптомы ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Симптомы</span>
						<FieldError>{fieldError('symptoms')}</FieldError>
						<div className={s.chips}>
							{symptoms.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.symptoms.includes(value) ? s.chipActive : ''}`}
									onClick={() => toggleArrayField('symptoms', value)}
					type="button"
					aria-pressed={form.symptoms.includes(value)}
					title={`Отметить симптом «${label}», который был во время приступа.`}
								>
									{label}
								</button>
							))}
						</div>
					</section>

					{/* ── Триггеры ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Триггеры</span>
						<FieldError>{fieldError('triggers')}</FieldError>
						<div className={s.chips}>
							{triggers.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.triggers.includes(value) ? s.chipActive : ''}`}
									onClick={() => toggleArrayField('triggers', value)}
					type="button"
					aria-pressed={form.triggers.includes(value)}
					title={`Отметить возможный провоцирующий фактор «${label}».`}
								>
									{label}
								</button>
							))}
						</div>
					</section>

					{/* ── Заметка ── */}
					<section className={s.section}>
						<Input as="textarea"
							label="Заметка о приступе" error={fieldError('note')} maxLength={2000}
							title="При желании добавьте личные наблюдения об этом приступе."
							value={form.note}
							onChange={e => setField('note', e.target.value)}
							rows={3}
						/>
					</section>
				</div>

				<div className={s.footer}>
					<button className={s.submitBtn} onClick={onSubmit} disabled={busy} title="Сохранить запись о приступе в дневнике.">
						Сохранить приступ
					</button>
					{onSubmitAnother && <button title={"Сохранить и добавить ещё"} className={s.anotherBtn} onClick={onSubmitAnother} disabled={busy}>Сохранить и добавить ещё</button>}
					{editing && <button
						type="button"
						className={s.deleteBtn}
						onClick={onDelete}
						disabled={busy}
						title="Удалить эту запись о приступе из дневника."
					>
						{deleting ? 'Удаляем приступ…' : 'Удалить приступ'}
					</button>}
				</div>
			</div>
		</div>
	)
}

export default AddAttackForm
