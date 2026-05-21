import { ATTACK_TYPE_LABELS, SYMPTOM_LABELS, TRIGGER_LABELS, intensityColor } from '@/entities/attack'
import s from './AddAttackForm.module.scss'

const TYPES    = Object.entries(ATTACK_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const SYMPTOMS = Object.entries(SYMPTOM_LABELS).map(([value, label]) => ({ value, label }))
const TRIGGERS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }))


const AddAttackForm = ({ open, form, error, onClose, setField, toggleArrayField, onSubmit }) => {
	if (!open) return null

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
			<div className={s.sheet}>
				<div className={s.handle} />

				<div className={s.header}>
					<h2 className={s.title}>Новый приступ</h2>
					<button className={s.closeBtn} onClick={onClose}>✕</button>
				</div>

				<div className={s.body}>
					{error && <p className={s.error}>{error}</p>}

					{/* ── Интенсивность ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Интенсивность боли</span>
						<div className={s.intensityRow}>
							<input
								type="range"
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
									value={form.startDate}
									onChange={e => setField('startDate', e.target.value)}
									className={s.timeInput}
								/>
								<input
									type="time"
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
										value={form.endDate}
										min={form.startDate}
										onChange={e => setField('endDate', e.target.value)}
										className={s.timeInput}
									/>
									<input
										type="time"
										value={form.endTime}
										onChange={e => setField('endTime', e.target.value)}
										className={s.timeInput}
									/>
								</div>
							)}
						</div>
						<label className={s.checkboxRow}>
							<input
								type="checkbox"
								checked={form.ongoing}
								onChange={e => setField('ongoing', e.target.checked)}
								className={s.checkbox}
							/>
							<span>Приступ продолжается</span>
						</label>
					</section>

					{/* ── Симптомы ── */}
					<section className={s.section}>
						<span className={s.sectionLabel}>Симптомы</span>
						<div className={s.chips}>
							{SYMPTOMS.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.symptoms.includes(value) ? s.chipActive : ''}`}
									onClick={() => toggleArrayField('symptoms', value)}
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
							{TRIGGERS.map(({ value, label }) => (
								<button
									key={value}
									className={`${s.chip} ${form.triggers.includes(value) ? s.chipActive : ''}`}
									onClick={() => toggleArrayField('triggers', value)}
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
							value={form.note}
							onChange={e => setField('note', e.target.value)}
							rows={3}
						/>
					</section>
				</div>

				<div className={s.footer}>
					<button className={s.submitBtn} onClick={onSubmit}>
						Сохранить приступ
					</button>
				</div>
			</div>
		</div>
	)
}

export default AddAttackForm
