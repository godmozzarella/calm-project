import { useEffect, useState } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { MEDICATION_PRESETS } from '@/entities/medication'
import { useBodyScrollLock } from '@/shared/lib/useBodyScrollLock'
import { localMinute } from '@/shared/lib/localMinute'
import { notifyRequestError } from '@/shared/lib/notifyError'
import { Input } from '@/shared/ui/Input'
import CloseButton from '@/shared/ui/Button/CloseButton'
import { useDictionaries } from '@/shared/lib/dictionaries'
import { medicationApi } from '@/shared/api'
import { BackIcon } from '@/shared/ui/icons'
import AttackTimeWheels from '@/features/add-attack/ui/AttackTimeWheels'
import { attacksForDate, formatAttackOption } from '../model/attackLink.mjs'
import s from './AddMedicationForm.module.scss'

const CUSTOM_CATEGORY = 'Из справочника'
const PERSONAL_CATEGORY = 'Свои препараты'

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
const StepSelect = ({ selected, isSelected, toggleItem, personalMedications,
	onAddPersonal, addingPersonal, onDeletePersonal, deletingPersonalId, selectionError }) => {
	const [customName, setCustomName] = useState('')
	const [query, setQuery] = useState('')
	const { medications } = useDictionaries()

	const addCustom = async event => {
		event.preventDefault()
		const name = customName.trim()
		if (!name || addingPersonal) return
		const saved = await onAddPersonal(name)
		if (!saved) return
		const item = { name: saved.name, dosage: saved.defaultDosage ?? '', personalMedicationId: saved.id, category: 'Другое' }
		if (!isSelected(item)) toggleItem(item)
		setCustomName('')
		setQuery('')
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
		? [{
			category: PERSONAL_CATEGORY,
			items: personalMedications.map(m => ({ name: m.name, dosage: m.defaultDosage ?? '', personalMedicationId: m.id, category: 'Другое' })),
		}, ...catalogGroups]
		: catalogGroups
	const search = query.trim().toLocaleLowerCase('ru-RU')
	const visibleGroups = allGroups.map(group => ({
		...group,
		items: group.items.filter(item => !search || item.name.toLocaleLowerCase('ru-RU').includes(search)
			|| group.category.toLocaleLowerCase('ru-RU').includes(search)),
	})).filter(group => group.items.length)

	return (
		<div className={`${s.stepBody} ${s.selectStep}`}>
			<Input type="search" label="Найти препарат" value={query} error={selectionError}
				onChange={event => setQuery(event.target.value)}
				rightElement={query
					? <button title="Очистить поиск" type="button" aria-label="Очистить поиск" onClick={() => setQuery('')}><CloseIcon fontSize="small" /></button>
					: <SearchIcon aria-hidden="true" fontSize="small" />} />
			{selected.length > 0 && (
				<div className={s.selectedSummary}>
					{selected.map(item => (
						<button
							key={itemKey(item)}
							className={s.selectedChip}
							onClick={() => toggleItem(item)}
							title={`Убрать препарат «${item.name}» из выбранного приёма.`}
							type="button"
						>
							{item.name}{item.category && item.category !== 'Другое' ? ` · ${item.category}` : ''}
							<span className={s.selectedChipX}>✕</span>
						</button>
					))}
				</div>
			)}

			<div className={s.catalogList} aria-label="Список препаратов">
				{visibleGroups.length ? visibleGroups.map(group => (
					<section key={group.category} className={s.categoryGroup}>
						<h3 className={s.categoryHeader}><span className={s.categoryLabel}>{group.category}</span></h3>
						<div className={s.catalogItems}>
							{group.items.map(item => {
								const fullItem = { ...item, category: item.category ?? group.category }
								const personal = Boolean(fullItem.personalMedicationId)
								const chosen = isSelected(fullItem)
								return <div key={`${group.category}-${item.name}`} className={s.catalogRow}>
									<button type="button" className={`${s.catalogItem} ${chosen ? s.catalogItemActive : ''}`}
										onClick={() => toggleItem(fullItem)} aria-pressed={chosen}
										title={`Выбрать препарат «${item.name}» для записи о приёме.`}>
										<span>{item.name}</span>{chosen && <CheckIcon fontSize="small" aria-hidden="true" />}
									</button>
									{personal && <button type="button" className={s.personalDelete}
										aria-label={`Удалить ${item.name} из своих препаратов`}
										disabled={deletingPersonalId === fullItem.personalMedicationId}
										onClick={() => onDeletePersonal(fullItem)}
										title="Удалить название препарата из вашего личного списка.">
										<DeleteOutlineIcon fontSize="small" aria-hidden="true" />
									</button>}
								</div>
							})}
						</div>
					</section>
				)) : <p className={s.searchEmpty}>Ничего не найдено. Добавьте свой препарат ниже.</p>}
			</div>

			<div className={s.customSection}>
				<form className={s.customRow} onSubmit={addCustom}>
					<Input
						id="personal-medication-name"
						type="text"
						label="Название своего препарата"
						title="Название сохраняется в вашем личном списке препаратов."
						wrapperClassName={s.customField}
						maxLength={120}
						value={customName}
						onChange={e => setCustomName(e.target.value)}
					/>
					<button
						className={s.customAddBtn}
						type="submit"
						disabled={!customName.trim() || addingPersonal}
						title="Сохранить свой препарат и добавить его в этот приём."
					>
						{addingPersonal ? 'Сохраняем…' : 'Добавить'}
					</button>
				</form>
			</div>
		</div>
	)
}

/* ── Step 2: дозировки ── */
const StepDosage = ({ selected, setItemDosage, error }) => (
	<div className={s.stepBody}>
		<h3 className={`${s.sectionLabel} ${s.dosageHeading}`}>Укажите дозировку для каждого препарата</h3>
		{selected.map(item => (
			<div key={`${item.category}-${item.name}`} className={s.dosageItem}>
				<div className={s.dosageMeta}>
					<span className={s.dosageName}>{item.name}</span>
					<span className={s.dosageCategory}>{item.category}</span>
				</div>
				<div className={s.dosageInputWrapper}>
					<Input
						type="text"
						inputMode="decimal"
						aria-label={`Дозировка препарата ${item.name}`}
						title={`Укажите дозировку препарата «${item.name}». Единица измерения показана справа.`}
						label="Дозировка"
						hint={!item.dosage && DOSAGE_HINTS[item.category] ? `Например, ${DOSAGE_HINTS[item.category]}` : undefined}
						error={error?.field === 'dosage' && (error.item ? error.item === `${item.category}::${item.name}` : item === selected[0]) ? error.message : undefined}
						rightElement={<span className={s.dosageUnit}>{DOSAGE_UNITS[item.category] ?? 'мг'}</span>}
						value={item.dosage}
						onChange={e =>
							setItemDosage(item.name, item.category, e.target.value.replace(/[^\d.,]/g, ''))
						}
					/>
				</div>
			</div>
		))}
	</div>
)

/* ── Step 3: дата, приступ, заметка ── */
const StepMeta = ({ meta, attacks, setMetaField, today, currentTime, error }) => {
	const fieldError = field => error?.field === field ? error.message : undefined
	return (
	<div className={s.stepBody}>
		<div className={s.section}>
			<span className={s.sectionLabel}>Время приёма</span>
			<div className={s.timeRow}>
				<div className={s.timeField}>
					<Input
						type="date"
						aria-label="Дата приёма" error={fieldError('date')}
						title="Выберите день, когда вы приняли препарат."
						value={meta.date}
						max={today}
						onChange={e => setMetaField('date', e.target.value)}
					/>
					<AttackTimeWheels key={meta.date} label="Время приёма препарата" error={fieldError('time')} value={meta.time} latestTime={meta.date === today ? currentTime : null} onChange={value => setMetaField('time', value)} />
				</div>
			</div>
		</div>

		{attacks.length > 0 && (
			<div className={s.section}>
				<Input as="select" label="Связать с приступом" error={fieldError('attackId')}
					value={meta.attackId ?? ''}
					aria-label="Связать препарат с приступом"
					title="Если препарат принят во время приступа, выберите этот приступ. Связь необязательна."
					onChange={e => setMetaField('attackId', e.target.value || null)}
				>
					<option value="">Без привязки</option>
					{attacks.map(a => (
						<option key={a.id} value={a.id}>{formatAttackOption(a)}</option>
					))}
				</Input>
			</div>
		)}

		<div className={s.section}>
			<Input as="textarea" label="Заметка о приёме" error={fieldError('note')} maxLength={2000}
				title="При желании добавьте личные наблюдения о приёме препарата."
				value={meta.note}
				onChange={e => setMetaField('note', e.target.value)}
				rows={3}
			/>
		</div>
	</div>
	)
}

/* ── Root ── */
const AddMedicationForm = ({
	open, step, selected, meta, error, attacks, editing, loading, deleting,
	onClose, toggleItem, isSelected, setItemDosage,
	setMetaField, onNext, onBack, onSubmit, onDelete,
}) => {
	useBodyScrollLock(open)
	const [personalMedications, setPersonalMedications] = useState([])
	const [, refreshClock] = useState(0)
	useEffect(() => {
		if (!open) return undefined
		const timer = window.setInterval(() => refreshClock(value => value + 1), 15000)
		return () => window.clearInterval(timer)
	}, [open])
	const [addingPersonal, setAddingPersonal] = useState(false)
	const [deletingPersonalId, setDeletingPersonalId] = useState(null)
	useEffect(() => {
		if (!open) { setPersonalMedications([]); return undefined }
		let active = true
		medicationApi.getPersonal()
			.then(list => { if (active) setPersonalMedications(list) })
			.catch(err => { if (active) notifyRequestError(err, 'Не удалось загрузить свои препараты') })
		return () => { active = false }
	}, [open])
	const addPersonal = async name => {
		setAddingPersonal(true)
		try {
			const saved = await medicationApi.addPersonal(name)
			setPersonalMedications(previous => [saved, ...previous.filter(item => item.id !== saved.id)])
			return saved
		} catch (err) {
			notifyRequestError(err, 'Не удалось добавить свой препарат')
			return null
		} finally {
			setAddingPersonal(false)
		}
	}
	const deletePersonal = async item => {
		setDeletingPersonalId(item.personalMedicationId)
		try {
			await medicationApi.deletePersonal(item.personalMedicationId)
			setPersonalMedications(previous => previous.filter(m => m.id !== item.personalMedicationId))
			if (isSelected(item)) toggleItem(item)
		} catch (err) {
			notifyRequestError(err, 'Не удалось удалить препарат')
		} finally {
			setDeletingPersonalId(null)
		}
	}
	if (!open) return null

	const isLastStep = step === 3
	const busy = loading || deleting || addingPersonal || Boolean(deletingPersonalId)
	const { date: today, time: currentTime } = localMinute()

	return (
		<div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
			<div className={s.sheet}>
				<div className={s.handle} />

				<div className={s.header}>
					<div className={s.headerTop}>
						<h2 className={s.title}>{editing ? `Редактировать · ${STEP_TITLES[step - 1]}` : STEP_TITLES[step - 1]}</h2>
						<CloseButton label="Закрыть форму препарата" title="Закрыть форму записи препарата." onClick={onClose} />
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

				<div className={`${s.body} ${step === 1 ? s.bodySelect : ''}`}>

					{step === 1 && (
						<StepSelect
							selected={selected}
							isSelected={isSelected}
							toggleItem={toggleItem}
							personalMedications={personalMedications}
							onAddPersonal={addPersonal}
							addingPersonal={addingPersonal}
							onDeletePersonal={deletePersonal}
							deletingPersonalId={deletingPersonalId}
							selectionError={error?.field === 'selection' ? error.message : undefined}
						/>
					)}
					{step === 2 && <StepDosage selected={selected} setItemDosage={setItemDosage} error={error} />}
					{step === 3 && <StepMeta meta={meta} attacks={attacksForDate(attacks, meta.date)} setMetaField={setMetaField} today={today} currentTime={currentTime} error={error} />}
				</div>

				<div className={s.footer}>
					<div className={s.navRow}>
						{step > 1 && (
							<button className={s.backBtn} onClick={onBack} disabled={busy} aria-label="Предыдущий шаг" title="Вернуться к предыдущему шагу записи препарата.">
								<BackIcon style={{ fontSize: '1.25rem' }} />
							</button>
						)}
						<button
							className={s.nextBtn}
							onClick={editing || isLastStep ? onSubmit : onNext}
							disabled={busy}
							title={editing || isLastStep ? 'Сохранить изменения приёма и закрыть форму.' : 'Перейти к следующему шагу записи препарата.'}
						>
							{loading ? 'Сохраняем…' : editing || isLastStep ? 'Сохранить' : 'Далее'}
							{!editing && !isLastStep && <BackIcon style={{ fontSize: '1.25rem', transform: 'scaleX(-1)' }} />}
						</button>
						{editing && !isLastStep && <button type="button" className={s.forwardBtn}
							onClick={onNext} disabled={busy} aria-label="Следующий шаг"
							title="Перейти к следующему шагу редактирования приёма.">
							<BackIcon style={{ fontSize: '1.25rem', transform: 'scaleX(-1)' }} />
						</button>}
					</div>
					{editing && <button type="button" className={s.deleteBtn}
						onClick={onDelete} disabled={busy}
						title="Удалить все препараты этого приёма из дневника.">
						{deleting ? 'Удаляем приём…' : 'Удалить приём'}
					</button>}
				</div>
			</div>
		</div>
	)
}

export default AddMedicationForm
