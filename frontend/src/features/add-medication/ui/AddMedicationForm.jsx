import { useEffect, useRef, useState } from 'react'
import { MEDICATION_PRESETS } from '@/entities/medication'
import { formatAttackTime, getAttackTypeLabel } from '@/entities/attack'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import ErrorNotice from '@/shared/ui/ErrorNotice/ErrorNotice'
import { useDictionaries } from '@/shared/lib/dictionaries'
import { medicationApi } from '@/shared/api'
import {
	MedicationIcon,
	LocalPharmacyIcon,
	WaterDropIcon,
	AirIcon,
	HealingIcon,
	ArrowForwardIcon,
	BackIcon,
} from '@/shared/ui/icons'
import s from './AddMedicationForm.module.scss'

const CUSTOM_CATEGORY = 'Из справочника'
const PERSONAL_CATEGORY = 'Свои препараты'

const CATEGORY_ICONS = {
	'Таблетки':               MedicationIcon,
	'Капсулы':                LocalPharmacyIcon,
	'Растворимые / Порошок':  WaterDropIcon,
	'Назальный спрей':        AirIcon,
	'Суппозитории':           HealingIcon,
	[CUSTOM_CATEGORY]:        LocalPharmacyIcon,
	[PERSONAL_CATEGORY]:      LocalPharmacyIcon,
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
const StepSelect = ({ selected, isSelected, toggleItem, clearSelection, editing, personalMedications,
	onDeletePersonal, deletingPersonalId }) => {
	const [customName, setCustomName] = useState('')
	const [revealedPersonalId, setRevealedPersonalId] = useState(null)
	const holdTimer = useRef(null)
	const touchStart = useRef(null)
	const suppressClick = useRef(false)
	const { medications } = useDictionaries()

	useEffect(() => () => clearTimeout(holdTimer.current), [])
	const cancelHold = () => {
		clearTimeout(holdTimer.current)
		holdTimer.current = null
		touchStart.current = null
	}
	const startHold = (event, id) => {
		if (event.pointerType !== 'touch') return
		cancelHold()
		suppressClick.current = false
		touchStart.current = { x: event.clientX, y: event.clientY }
		holdTimer.current = setTimeout(() => {
			setRevealedPersonalId(id)
			suppressClick.current = true
			holdTimer.current = null
		}, 550)
	}
	const moveHold = event => {
		if (touchStart.current &&
			Math.hypot(event.clientX - touchStart.current.x, event.clientY - touchStart.current.y) > 10) {
			cancelHold()
		}
	}
	const selectItem = item => {
		if (suppressClick.current) {
			suppressClick.current = false
			return
		}
		setRevealedPersonalId(null)
		toggleItem(item)
	}

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

	const catalogGroups = customPresets.length
		? [...MEDICATION_PRESETS, {
			category: CUSTOM_CATEGORY,
			items: customPresets.map(m => ({ name: m.label, dosage: '' })),
		}]
		: MEDICATION_PRESETS
	const allGroups = personalMedications.length
		? [...catalogGroups, {
			category: PERSONAL_CATEGORY,
			items: personalMedications.map(m => ({ name: m.name, dosage: '', personalMedicationId: m.id, category: 'Другое' })),
		}]
		: catalogGroups

	return (
		<div className={s.stepBody}>
			{selected.length > 0 && (
				<div className={s.selectedSummary}>
					{selected.map(item => (
						<button
							key={itemKey(item)}
							className={s.selectedChip}
							onClick={() => toggleItem(item)}
							data-help={`Убрать препарат «${item.name}» из выбранного приёма.`}
							type="button"
						>
							{item.name}{item.category && item.category !== 'Другое' ? ` · ${item.category}` : ''}
							<span className={s.selectedChipX}>✕</span>
						</button>
					))}
				</div>
			)}

			<p className={s.stepHint}>{editing ? 'Выберите все препараты этого приёма заново' : 'Можно выбрать несколько'}</p>
			{editing && selected.length > 0 && (
				<button type="button" className={s.clearSelectionBtn} onClick={clearSelection}>
					Очистить список и выбрать заново
				</button>
			)}

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
				const fullItem = { ...item, category: item.category ?? group.category }
								const personal = Boolean(fullItem.personalMedicationId)
								const chip = <button
										key={`${group.category}-${item.name}`}
										className={`${s.chip} ${isSelected(fullItem) ? s.chipActive : ''}`}
										onClick={() => selectItem(fullItem)}
										data-help={`Выбрать препарат «${item.name}» для записи о приёме.`}
										onPointerDown={personal ? event => startHold(event, fullItem.personalMedicationId) : undefined}
										onPointerMove={personal ? moveHold : undefined}
										onPointerUp={personal ? cancelHold : undefined}
										onPointerCancel={personal ? cancelHold : undefined}
										onPointerLeave={personal ? cancelHold : undefined}
										onContextMenu={personal ? event => event.preventDefault() : undefined}
									aria-pressed={isSelected(fullItem)}
										type="button"
									>
										{item.name}
									</button>
								if (!personal) return chip
								return (
									<div key={fullItem.personalMedicationId} className={`${s.personalChip} ${revealedPersonalId === fullItem.personalMedicationId ? s.personalChipRevealed : ''}`}>
										{chip}
										<div className={s.personalDeleteSlot}>
											<button type="button" className={s.personalDelete}
												aria-label={`Удалить ${item.name} из своих препаратов`}
												disabled={deletingPersonalId === fullItem.personalMedicationId}
								onClick={() => { setRevealedPersonalId(null); onDeletePersonal(fullItem) }}
								data-help="Удалить название препарата из вашего личного списка.">
												×
											</button>
										</div>
									</div>
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
						aria-label="Название своего препарата"
						data-help="Если препарата нет в списке, введите его название и добавьте в свой список."
						className={s.customInput}
						placeholder="Свой препарат..."
						maxLength={120}
						value={customName}
						onChange={e => setCustomName(e.target.value)}
						onKeyDown={e => e.key === 'Enter' && addCustom()}
					/>
					<button
						className={s.customAddBtn}
						onClick={addCustom}
						type="button"
						disabled={!customName.trim()}
						data-help="Добавить введённый препарат в выбранный приём."
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
						aria-label={`Дозировка препарата ${item.name}`}
						data-help={`Укажите дозировку препарата «${item.name}». Единица измерения показана справа.`}
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
						aria-label="Дата приёма препарата"
						data-help="Выберите день, когда вы приняли препарат."
						value={meta.date}
						onChange={e => setMetaField('date', e.target.value)}
						className={s.timeInput}
					/>
				</div>
				<div className={s.timeField}>
					<span>Время</span>
					<input
						type="time"
						aria-label="Время приёма препарата"
						data-help="Укажите время, когда вы приняли препарат."
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
					aria-label="Связать препарат с приступом"
					data-help="Если препарат принят во время приступа, выберите этот приступ. Связь необязательна."
					onChange={e => setMetaField('attackId', e.target.value || null)}
				>
					<option value="">— не привязывать —</option>
					{attacks.map(a => (
						<option key={a.id} value={a.id}>
							{a.startDate} {formatAttackTime(a.startTime)}{a.endTime ? ` — ${formatAttackTime(a.endTime)}` : a.ongoing ? ' — продолжается' : ''}
							{' · '}{getAttackTypeLabel(a.type)}
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
				aria-label="Заметка о приёме препарата"
				data-help="При желании добавьте личные наблюдения о приёме препарата."
				value={meta.note}
				onChange={e => setMetaField('note', e.target.value)}
				rows={3}
			/>
		</div>
	</div>
)

/* ── Root ── */
const AddMedicationForm = ({
	open, step, selected, meta, error, attacks, editing, loading,
	onClose, toggleItem, isSelected, clearSelection, setItemDosage,
	setMetaField, onNext, onBack, onSubmit,
}) => {
	useBodyScrollLock(open)
	const [personalMedications, setPersonalMedications] = useState([])
	const [personalError, setPersonalError] = useState('')
	const [deletingPersonalId, setDeletingPersonalId] = useState(null)
	useEffect(() => {
		if (!open) return undefined
		let active = true
		setPersonalError('')
		medicationApi.getPersonal()
			.then(list => { if (active) setPersonalMedications(list) })
			.catch(() => { if (active) setPersonalError('Не удалось загрузить свои препараты') })
		return () => { active = false }
	}, [open])
	const deletePersonal = async item => {
		setDeletingPersonalId(item.personalMedicationId)
		setPersonalError('')
		try {
			await medicationApi.deletePersonal(item.personalMedicationId)
			setPersonalMedications(previous => previous.filter(m => m.id !== item.personalMedicationId))
			if (isSelected(item)) toggleItem(item)
		} catch (err) {
			setPersonalError(err.message || 'Не удалось удалить препарат')
		} finally {
			setDeletingPersonalId(null)
		}
	}
	if (!open) return null

	const isLastStep = step === 3

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
			<div className={s.sheet}>
				<div className={s.handle} />

				<div className={s.header}>
					<div className={s.headerTop}>
						<h2 className={s.title}>{editing ? `Редактировать · ${STEP_TITLES[step - 1]}` : STEP_TITLES[step - 1]}</h2>
						<button className={s.closeBtn} onClick={onClose} aria-label="Закрыть форму препарата" data-help="Закрыть форму записи препарата.">✕</button>
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
					<ErrorNotice message={error} title="Не удалось сохранить препарат" />
					<ErrorNotice message={personalError} title="Свои препараты" />

					{step === 1 && (
						<StepSelect
							selected={selected}
							isSelected={isSelected}
							toggleItem={toggleItem}
							clearSelection={clearSelection}
							editing={editing}
							personalMedications={personalMedications}
							onDeletePersonal={deletePersonal}
							deletingPersonalId={deletingPersonalId}
						/>
					)}
					{step === 2 && <StepDosage selected={selected} setItemDosage={setItemDosage} />}
					{step === 3 && <StepMeta meta={meta} attacks={attacks} setMetaField={setMetaField} />}
				</div>

				<div className={s.footer}>
					<div className={s.navRow}>
						{step > 1 && (
							<button className={s.backBtn} onClick={onBack} aria-label="Предыдущий шаг" data-help="Вернуться к предыдущему шагу записи препарата.">
								<BackIcon style={{ fontSize: '1.25rem' }} />
							</button>
						)}
						<button
							className={s.nextBtn}
							onClick={isLastStep ? onSubmit : onNext}
							disabled={loading}
							data-help={isLastStep ? 'Сохранить приём препарата в дневнике.' : 'Перейти к следующему шагу записи препарата.'}
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
