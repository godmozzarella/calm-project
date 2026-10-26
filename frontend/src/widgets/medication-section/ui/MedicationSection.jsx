import { useState, useCallback, useEffect } from 'react'

import { AddIcon, DeleteIcon, EditIcon } from '@/shared/ui/icons'
import { AddMedicationForm, useAddMedication } from '@/features/add-medication'
import { EFFECTIVENESS_LABELS, OVERUSE_THRESHOLD } from '@/entities/medication'
import { formatAttackTime, getAttackTypeLabel, sortAttacksNewest } from '@/entities/attack'
import { attackApi, medicationApi } from '@/shared/api'
import { subscribe, ATTACKS_CHANGED, MEDICATIONS_CHANGED } from '@/shared/lib/dataEvents'

import s from './MedicationSection.module.scss'


const MedicationSection = ({ date, onInitialReady }) => {
	const [medications, setMedications] = useState([])
	const [attacks,     setAttacks]     = useState([])
	const [overuseDays, setOveruseDays] = useState(0)

	const reload = useCallback(() => {
		const [year, month] = date.split('-').map(Number)
		return Promise.allSettled([
			medicationApi.getByDate(date).then(setMedications),
			attackApi.getByDate(date).then(list => setAttacks(sortAttacksNewest(list))),
			medicationApi.getOveruseDays(year, month).then(setOveruseDays),
		])
	}, [date])

	useEffect(() => {
		let active = true
		reload().then(() => { if (active) onInitialReady?.('medications') })
		return () => { active = false }
	}, [reload, onInitialReady])

	useEffect(() => {
		const off1 = subscribe(ATTACKS_CHANGED, reload)
		const off2 = subscribe(MEDICATIONS_CHANGED, reload)
		return () => { off1(); off2() }
	}, [reload])

	const {
		open, step, selected, meta, error, loading, editingIntake,
		openForm, openEditForm, closeForm,
		toggleItem, isSelected, clearSelection, setItemDosage,
		setMetaField, nextStep, prevStep, submit,
	} = useAddMedication({ date, onSuccess: reload })

	const handleDelete = id => medicationApi.delete(id)
	const handleCardClick = event => {
		if (!event.target.closest('button, a, input, select, textarea')) openForm()
	}

	const handleEffectiveness = (id, value) => {
		const med = medications.find(m => m.id === id)
		if (!med) return
		medicationApi.update(id, { ...med, effectiveness: med.effectiveness === value ? null : value })
	}

	const linkedAttack = attackId => attacks.find(a => a.id === attackId)

	return (
		<>
			<div className={s.card} onClick={handleCardClick} data-help="Препараты: здесь можно записать приём лекарства и позже оценить, помогло ли оно.">
				<div className={s.cardHeader}>
					<h2 className={s.title}>Препараты</h2>
					<button className={s.addBtn} onClick={openForm} aria-label="Добавить препарат" data-help="Записать препарат, который вы приняли в выбранный день, его дозировку и время приёма.">
						<AddIcon fontSize="small" />
						<span>Добавить</span>
					</button>
				</div>

				<div className={s.cardBody}>
					{overuseDays > OVERUSE_THRESHOLD && (
						<div className={s.overuseWarning}>
							Обезболивающие принимались {overuseDays} дней в этом месяце
							— риск абузусной головной боли
						</div>
					)}

					{medications.length === 0 ? (
						<div className={s.empty}>
							<p className={s.emptyText}>Ничего не принято</p>
							<p className={s.emptyHint}>Препараты, дозировки и их эффективность</p>
						</div>
					) : (
						<ul className={s.list}>
							{medications.map(med => {
								const attack = med.attackId ? linkedAttack(med.attackId) : null
								return (
									<li key={med.id} className={s.medCard}>
										<div className={s.medTop}>
											<div className={s.medMeta}>
												<span className={s.medName}>{med.name}</span>
												{med.dosage && (
													<span className={s.medDosage}>{med.dosage}</span>
												)}
											</div>
											<div className={s.medRight}>
												<span className={s.medTime}>{formatAttackTime(med.time)}</span>
												<button
													className={s.editBtn}
													onClick={() => openEditForm(med, medications)}
													aria-label="Редактировать приём препаратов"
													title="Изменить все препараты этого приёма"
												data-help="Изменить препараты и время этого приёма."
												>
													<EditIcon style={{ fontSize: '1rem' }} />
												</button>
												<button
													className={s.deleteBtn}
													onClick={() => handleDelete(med.id)}
													aria-label="Удалить"
												data-help="Удалить эту запись о приёме препарата."
												>
													<DeleteIcon style={{ fontSize: '1rem' }} />
												</button>
											</div>
										</div>

										{attack && (
											<div className={s.attackLink}>
												Приступ {attack.startDate} {formatAttackTime(attack.startTime)}
												{attack.endTime ? ` — ${formatAttackTime(attack.endTime)}` : attack.ongoing ? ' — продолжается' : ''}
												{' · '}{getAttackTypeLabel(attack.type)}
												{' · '}{attack.intensity}/10
											</div>
										)}

										<div className={s.effectivenessRow}>
											{[1, 2, 3].map(v => (
												<button
													key={v}
													className={`${s.effectBtn} ${med.effectiveness === v ? s.effectBtnActive : ''}`}
											data-effectiveness={v}
													aria-pressed={med.effectiveness === v}
													onClick={() => handleEffectiveness(med.id, med.effectiveness === v ? null : v)}
													data-help={`Оценить действие препарата: «${EFFECTIVENESS_LABELS[v]}». Повторное нажатие снимет оценку.`}
												>
													{EFFECTIVENESS_LABELS[v]}
												</button>
											))}
										</div>

										{med.note && <p className={s.note}>{med.note}</p>}
									</li>
								)
							})}
						</ul>
					)}
				</div>
			</div>

			<AddMedicationForm
				open={open}
				step={step}
				selected={selected}
				meta={meta}
				error={error}
				loading={loading}
				editing={!!editingIntake}
				attacks={attacks}
				onClose={closeForm}
				toggleItem={toggleItem}
				isSelected={isSelected}
				clearSelection={clearSelection}
				setItemDosage={setItemDosage}
				setMetaField={setMetaField}
				onNext={nextStep}
				onBack={prevStep}
				onSubmit={submit}
			/>
		</>
	)
}

export default MedicationSection
