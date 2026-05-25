import { useState } from 'react'
import { MEDICATION_PRESETS } from '@/entities/medication'
import { ATTACK_TYPE_LABELS } from '@/entities/attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { useDictionaries } from '@/shared/lib/dictionaries'
import {
	MedicationIcon,
	LocalPharmacyIcon,
	WaterDropIcon,
	AirIcon,
	HealingIcon,
	ArrowForwardIcon,
	ArrowBackIcon,
} from '@/shared/ui/icons'
import s from './AddMedicationForm.module.scss'

const CUSTOM_CATEGORY = 'Из справочника'

const CATEGORY_ICONS = {
	'Таблетки':               MedicationIcon,
	'Капсулы':                LocalPharmacyIcon,
	'Растворимые / Порошок':  WaterDropIcon,
	'Назальный спрей':        AirIcon,
	'Суппозитории':           HealingIcon,
	[CUSTOM_CATEGORY]:        LocalPharmacyIcon,
}

const DOSAGE_HINTS = {
	'Таблетки':               '50',
	'Капсулы':                '200',
	'Растворимые / Порошок':  '500',
	'Назальный спрей':        '1',
	'Суппозитории':           '25',
	'Другое':                 '100',
}

const DOSAGE_UNITS = {
	'Таблетки':               'мг',
	'Капсулы':                'мг',
	'Растворимые / Порошок':  'мг',
	'Назальный спрей':        'доза',
	'Суппозитории':           'мг',
	'Другое':                 'мг',
}

const STEP_TITLES = ['Препарат', 'Дозировка', 'Дата и заметки']

const itemKey = item => `${item.category}::${item.name}`

/* ── Step 1: выбор препаратов ── */
const StepSelect = ({ selected, isSelected, toggleItem }) => {
	const [customName, setCustomName] = useState('')
	const { medications } = useDictionaries()

	const addCustom = () => {
		const name = customName.trim()
		if (!name) return
		toggleItem({ name, dosage: '', category: 'Другое' })
		setCustomName('')
	}

	// Препараты из админского справочника — отдельная группа, чтобы не дублировать пресеты.
	// Защита от дублей: если уже есть в MEDICATION_PRESETS по имени — не показываем во второй раз.
	const hardcodedNames = new Set(
		MEDICATION_PRESETS.flatMap(g => g.items.map(i => i.name.toLowerCase()))
	)
	const customPresets = medications.filter(m => !hardcodedNames.has(m.label.toLowerCase()))

	const allGroups = customPresets.length
		? [...MEDICATION_PRESETS, {
			category: CUSTOM_CATEGORY,
			items: customPresets.map(m => ({ name: m.label, dosage: '' })),
		}]
		: MEDICATION_PRESETS

	return (
		<div className={s.stepBody}>
			{selected.length > 0 && (
				<div className={s.selectedSummary}>
					{selected.map(item => (
						<button
							key={itemKey(item)}
							className={s.selectedChip}
							onClick={() => toggleItem(item)}
							type="button"
						>
							{item.name}
							<span className={s.selectedChipX}>✕</span>
						</button>
					))}
				</div>
			)}

			<p className={s.stepHint}>Можно выбрать несколько</p>

			{allGroups.map(group => {
				const Icon = CATEGORY_ICONS[group.category]
				return (
					<div key={group.category} className={s.categoryGroup}>
						<div className={s.categoryHeader}>
							{Icon && <Icon className={s.categoryIcon} fontSize="small" />}
							<span className={s.categoryLabel}>{group.category}</span>
						</div>
						<div className={s.chips}>
							{group.items.map(item => {
								const fullItem = { ...item, category: group.category }
								return (
									<button
										key={`${group.category}-${item.name}`}
										className={`${s.chip} ${isSelected(fullItem) ? s.chipActive : ''}`}
										onClick={() => toggleItem(fullItem)}
										type="button"
									>
										{item.name}
									</button>
								)
							})}
						</div>
					</div>
				)
			})}

			<div className={s.customSection}>
				<div className={s.customRow}>
					<input
						type="text"
						className={s.customInput}
						placeholder="Свой препарат..."
						value={customName}
						onChange={e => setCustomName(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && addCustom()}
					/>
					<button
						className={s.customAddBtn}
						onClick={addCustom}
						type="button"
						disabled={!customName.trim()}
					>
						Добавить
					</button>
				</div>
			</div>
		</div>
	)
}

/* ── Step 2: дозировки ── */
const StepDosage = ({ selected, setItemDosage }) => (
	<div className={s.stepBody}>
		<p className={s.stepHint}>Укажите дозировку для каждого препарата</p>
		{selected.map(item => (
			<div key={`${item.category}-${item.name}`} className={s.dosageItem}>
				<div className={s.dosageMeta}>
					<span className={s.dosageName}>{item.name}</span>
					<span className={s.dosageCategory}>{item.category}</span>
				</div>
				<div className={s.dosageInputWrapper}>
					<input
						type="text"
						inputMode="decimal"
						className={s.dosageInput}
						placeholder={DOSAGE_HINTS[item.category] ?? ''}
						value={item.dosage}
						onChange={e =>
							setItemDosage(item.name, item.category, e.target.value.replace(/[^\d.,]/g, ''))
						}
					/>
					<span className={s.dosageUnit}>{DOSAGE_UNITS[item.category] ?? 'мг'}</span>
				</div>
			</div>
		))}
	</div>
)

/* ── Step 3: дата, приступ, заметка ── */
const StepMeta = ({ meta, attacks, setMetaField }) => (
	<div className={s.stepBody}>
		<div className={s.section}>
			<span className={s.sectionLabel}>Время приёма</span>
			<div className={s.timeRow}>
				<div className={s.timeField}>
					<span>Дата</span>
					<input
						type="date"
						value={meta.date}
						onChange={e => setMetaField('date', e.target.value)}
						className={s.timeInput}
					/>
				</div>
				<div className={s.timeField}>
					<span>Время</span>
					<input
						type="time"
						value={meta.time}
						onChange={e => setMetaField('time', e.target.value)}
						className={s.timeInput}
					/>
				</div>
			</div>
		</div>

		{attacks.length > 0 && (
			<div className={s.section}>
				<span className={s.sectionLabel}>Во время приступа</span>
				<select
					className={s.select}
					value={meta.attackId ?? ''}
					onChange={e => setMetaField('attackId', e.target.value || null)}
				>
					<option value="">— не привязывать —</option>
					{attacks.map(a => (
						<option key={a.id} value={a.id}>
							{a.startTime}{a.endTime ? ` — ${a.endTime}` : a.ongoing ? ' — сейчас' : ''}
							{' · '}{ATTACK_TYPE_LABELS[a.type]}
							{' · '}{a.intensity}/10
						</option>
					))}
				</select>
			</div>
		)}

		<div className={s.section}>
			<span className={s.sectionLabel}>Заметка</span>
			<textarea
				className={s.textarea}
				placeholder="Дополнительные наблюдения..."
				value={meta.note}
				onChange={e => setMetaField('note', e.target.value)}
				rows={3}
			/>
		</div>
	</div>
)

/* ── Root ── */
const AddMedicationForm = ({
	open, step, selected, meta, error, attacks,
	onClose, toggleItem, isSelected, setItemDosage,
	setMetaField, onNext, onBack, onSubmit,
}) => {
	useBodyScrollLock(open)
	if (!open) return null

	const isLastStep = step === 3

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
			<div className={s.sheet}>
				<div className={s.handle} />

				<div className={s.header}>
					<div className={s.headerTop}>
						<h2 className={s.title}>{STEP_TITLES[step - 1]}</h2>
						<button className={s.closeBtn} onClick={onClose}>✕</button>
					</div>
					<div className={s.stepDots}>
						{[1, 2, 3].map(n => (
							<span
								key={n}
								className={`${s.stepDot} ${n <= step ? s.stepDotActive : ''}`}
							/>
						))}
						{selected.length > 0 && step === 1 && (
							<span className={s.selectedBadge}>{selected.length} выбрано</span>
						)}
					</div>
				</div>

				<div className={s.body}>
					{error && <p className={s.error}>{error}</p>}

					{step === 1 && (
						<StepSelect
							selected={selected}
							isSelected={isSelected}
							toggleItem={toggleItem}
						/>
					)}
					{step === 2 && <StepDosage selected={selected} setItemDosage={setItemDosage} />}
					{step === 3 && <StepMeta meta={meta} attacks={attacks} setMetaField={setMetaField} />}
				</div>

				<div className={s.footer}>
					<div className={s.navRow}>
						{step > 1 && (
							<button className={s.backBtn} onClick={onBack}>
								<ArrowBackIcon style={{ fontSize: '1.1rem' }} />
							</button>
						)}
						<button
							className={s.nextBtn}
							onClick={isLastStep ? onSubmit : onNext}
						>
							{isLastStep ? 'Сохранить' : 'Далее'}
							{!isLastStep && <ArrowForwardIcon style={{ fontSize: '1.1rem' }} />}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default AddMedicationForm
