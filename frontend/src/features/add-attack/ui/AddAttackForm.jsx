import { useEffect, useState } from 'react'

import { ATTACK_TYPE_LABELS, intensityColor } from '@/entities/attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { dictionaryApi } from '@/shared/api'
import s from './AddAttackForm.module.scss'

const TYPES = Object.entries(ATTACK_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const todayKey = () => {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const AddAttackForm = ({ open, form, error, loading, editing, onClose, setField, toggleArrayField, onSubmit }) => {
	useBodyScrollLock(open)
	const [symptoms, setSymptoms] = useState([])
	const [triggers, setTriggers] = useState([])

	useEffect(() => {
		if (!open) return
		dictionaryApi.getByType('SYMPTOM').then(setSymptoms).catch(() => {})
		dictionaryApi.getByType('TRIGGER').then(setTriggers).catch(() => {})
	}, [open])

	if (!open) return null

	const today = todayKey()

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
			<div className={s.sheet}>
				<div className={s.handle} />

				<div className={s.header}>
					<h2 className={s.title}>{editing ? 'Редактировать приступ' : 'Новый приступ'}</h2>
					<button className={s.closeBtn} onClick={onClose} aria-label="Закрыть форму приступа" data-help="Закрыть форму записи приступа.">✕</button>
				</div>

				<div className={s.body}>
					<ErrorNotice message={error} title="Не удалось сохранить приступ" />

					{/* ── Интенсивность ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Интенсивность боли</span>
						<div className={s.intensityRow}>
							<input
								type="range"
								aria-label="Сила боли от 1 до 10"
								data-help="Выберите силу боли: 1 — слабая, 10 — очень сильная."
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
								<input
									type="time"
									aria-label="Время начала приступа"
									data-help="Укажите время начала приступа."
									value={form.startTime}
									onChange={e => setField('startTime', e.target.value)}
									className={s.timeInput}
								/>
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
									<input
										type="time"
										aria-label="Время окончания приступа"
										data-help="Укажите время окончания приступа."
										value={form.endTime}
										onChange={e => setField('endTime', e.target.value)}
										className={s.timeInput}
									/>
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
					<button className={s.submitBtn} onClick={onSubmit} disabled={loading} data-help="Сохранить запись о приступе в дневнике.">
						Сохранить приступ
					</button>
				</div>
			</div>
		</div>
	)
}

export default AddAttackForm
