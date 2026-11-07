import { useEffect, useRef, useState } from 'react'

import { ATTACK_TYPE_LABELS, intensityColor } from '@/entities/attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { localMinute } from '@/shared/lib/localMinute'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { dictionaryApi } from '@/shared/api'
import { CloseIcon } from '@/shared/ui/icons'
import AttackTimeWheels from './AttackTimeWheels'
import s from './AddAttackForm.module.scss'

const TYPES = Object.entries(ATTACK_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const AddAttackForm = ({ open, form, error, deleteError, loading, deleting, editing, onClose, setField, toggleArrayField, onSubmit, onSubmitAnother, onDelete, title }) => {
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
		const previous=document.activeElement
		sheet.current?.querySelector('button')?.focus({ preventScroll:true })
		return () => { if(previous?.isConnected) previous.focus({ preventScroll:true }) }
	}, [open])

	if (!open) return null

	const { date: today, time: currentTime } = localMinute()
	const busy = loading || deleting

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()} onKeyDown={e => { if(e.key==='Escape') { e.stopPropagation(); if(!busy) onClose() } }}>
			<div ref={sheet} className={s.sheet} aria-busy={busy} data-attack-form role="dialog" aria-modal="true" aria-label={title || (editing ? 'Редактировать приступ' : 'Новый приступ')}>
				<div className={s.handle} />

				<div className={s.header}>
					<h2 className={s.title}>{title || (editing ? 'Редактировать приступ' : 'Новый приступ')}</h2>
					<button className={s.closeBtn} onClick={onClose} disabled={busy} aria-label="Закрыть форму приступа" data-help="Закрыть форму записи приступа."><CloseIcon style={{fontSize:'1.2rem'}}/></button>
				</div>

				<div className={s.body}>
					<ErrorNotice message={error} title="Не удалось сохранить приступ" />
					<ErrorNotice message={deleteError} title="Не удалось удалить приступ" />

					{/* ── Интенсивность ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Интенсивность боли</span>
						<div className={s.intensityRow}>
							<input
								type="range"
								aria-label="Сила боли от 1 до 10"
								min={1} max={10}
								value={form.intensity}
								onChange={e => setField('intensity', Number(e.target.value))}
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
						<div className={s.chips}>
							{TYPES.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.type === value ? s.chipActive : ''}`}
									onClick={() => setField('type', value)}
					type="button"
					aria-pressed={form.type === value}
					data-help={`Выбрать тип боли «${label}» для этого приступа.`}
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
								<input
									type="date"
									aria-label="Дата начала приступа"
									data-help="Укажите день, когда начался приступ."
									value={form.startDate}
									max={today}
									onChange={e => setField('startDate', e.target.value)}
									className={s.timeInput}
								/>
								<AttackTimeWheels key={`start-${form.startDate}`} label="Время начала приступа" value={form.startTime} latestTime={form.startDate === today ? currentTime : null} onChange={value => setField('startTime', value)} />
							</div>
							{!form.ongoing && (
								<div className={s.timeField}>
									<span>Конец</span>
									<input
										type="date"
										aria-label="Дата окончания приступа"
										data-help="Укажите день, когда приступ закончился."
										value={form.endDate}
										min={form.startDate}
										max={today}
										onChange={e => setField('endDate', e.target.value)}
										className={s.timeInput}
									/>
									<AttackTimeWheels key={`end-${form.endDate}`} label="Время окончания приступа" value={form.endTime} latestTime={form.endDate === today ? currentTime : null} onChange={value => setField('endTime', value)} />
								</div>
							)}
						</div>
						<button
							type="button"
							className={s.ongoingToggle}
							role="switch"
							aria-checked={form.ongoing}
							aria-label="Приступ продолжается"
							data-help="Включите, если приступ ещё не закончился. Время окончания можно будет указать позже."
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
						<div className={s.chips}>
							{symptoms.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.symptoms.includes(value) ? s.chipActive : ''}`}
									onClick={() => toggleArrayField('symptoms', value)}
					type="button"
					aria-pressed={form.symptoms.includes(value)}
					data-help={`Отметить симптом «${label}», который был во время приступа.`}
								>
									{label}
								</button>
							))}
						</div>
					</section>

					{/* ── Триггеры ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Триггеры</span>
						<div className={s.chips}>
							{triggers.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.triggers.includes(value) ? s.chipActive : ''}`}
									onClick={() => toggleArrayField('triggers', value)}
					type="button"
					aria-pressed={form.triggers.includes(value)}
					data-help={`Отметить возможный провоцирующий фактор «${label}».`}
								>
									{label}
								</button>
							))}
						</div>
					</section>

					{/* ── Заметка ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Заметка</span>
						<textarea
							className={s.textarea}
							placeholder="Дополнительные наблюдения..."
							aria-label="Заметка о приступе"
							data-help="При желании добавьте личные наблюдения об этом приступе."
							value={form.note}
							onChange={e => setField('note', e.target.value)}
							rows={3}
						/>
					</section>
				</div>

				<div className={s.footer}>
					<button className={s.submitBtn} onClick={onSubmit} disabled={busy} data-help="Сохранить запись о приступе в дневнике.">
						Сохранить приступ
					</button>
					{onSubmitAnother && <button className={s.anotherBtn} onClick={onSubmitAnother} disabled={busy}>Сохранить и добавить ещё</button>}
					{editing && <button
						type="button"
						className={s.deleteBtn}
						onClick={onDelete}
						disabled={busy}
						data-help="Удалить эту запись о приступе из дневника."
					>
						{deleting ? 'Удаляем приступ…' : 'Удалить приступ'}
					</button>}
				</div>
			</div>
		</div>
	)
}

export default AddAttackForm
