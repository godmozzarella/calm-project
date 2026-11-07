import { useState, useCallback, useEffect } from 'react'
import AddIcon from '@mui/icons-material/Add'

import { AddMedicationForm, formatAttackOption, groupMedicationIntakes, useAddMedication } from '@/features/add-medication'
import { EFFECTIVENESS_LABELS, OVERUSE_THRESHOLD } from '@/entities/medication'
import { formatAttackTime, sortAttacksNewest } from '@/entities/attack'
import { attackApi, medicationApi } from '@/shared/api'
import { subscribe, ATTACKS_CHANGED, MEDICATIONS_CHANGED } from '@/shared/lib/dataEvents'

import s from './MedicationSection.module.scss'

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const shortDate = iso => {
	const [, month, day] = String(iso ?? '').split('-').map(Number)
	return day && month >= 1 && month <= 12 ? `${day} ${MONTH_SHORT[month - 1]}` : ''
}


const MedicationSection = ({ date, onInitialReady }) => {
	const [medications, setMedications] = useState([])
	const [attacks,     setAttacks]     = useState([])
	const [overuseDays, setOveruseDays] = useState(0)
	const [ratingOpenId, setRatingOpenId] = useState(null)

	const reload = useCallback(() => {
		const [year, month] = date.split('-').map(Number)
		return Promise.allSettled([
			medicationApi.getByDate(date).then(setMedications),
			attackApi.getAll().then(list => setAttacks(sortAttacksNewest(list))),
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
		open, step, selected, meta, error, deleteError, loading, deleting, editingIntake,
		openForm, openEditForm, closeForm,
		toggleItem, isSelected, clearSelection, setItemDosage,
		setMetaField, nextStep, prevStep, submit, remove,
	} = useAddMedication({ date, attacks, onSuccess: reload })

	const handleCardClick = event => {
		if (!event.target.closest('button, a, input, select, textarea')) openForm()
	}

	const handleEffectiveness = (id, value) => {
		const med = medications.find(m => m.id === id)
		if (!med) return
		const effectiveness = med.effectiveness === value ? null : value
		setRatingOpenId(null)
		setMedications(previous => previous.map(item => item.id === id ? { ...item, effectiveness } : item))
		medicationApi.update(id, { ...med, effectiveness }).catch(reload)
	}

	const linkedAttack = attackId => attacks.find(a => a.id === attackId)

	return (
		<>
			<div className={s.card} onClick={handleCardClick} data-help="Препараты: здесь можно записать приём лекарства и позже оценить, помогло ли оно.">
				<div className={s.cardHeader}>
					<h2 className={s.title}>Препараты</h2>
					<button type="button" className={s.addBtn} onClick={openForm} aria-label="Добавить препарат" data-help="Записать препарат, который вы приняли в выбранный день, его дозировку и время приёма.">
						<AddIcon fontSize="small" />
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
							{groupMedicationIntakes(medications).map(intake => {
								const first = intake.medications[0]
								const attack = first.attackId ? linkedAttack(first.attackId) : null
								return (
									<li key={intake.id} className={s.medCard}>
										<button type="button" className={s.medCardOpen}
											onClick={() => openEditForm(first, intake.medications)}
											aria-label={`Редактировать приём: ${intake.medications.map(item => item.name).join(', ')}, ${shortDate(first.date)} ${formatAttackTime(first.time)}`}
											data-help="Открыть редактирование этого приёма препаратов." />
										<div className={s.medTop}>
											<div className={s.medMeta}>
												<span className={s.medDate}>{shortDate(first.date)}</span>
												<span className={s.medTime}>{formatAttackTime(first.time)}</span>
											</div>
										</div>

										<div className={s.medDetails}>
											<div className={s.medicationList}>
												{intake.medications.map(med => (
													<div key={med.id} className={s.medicationItem}>
														<div className={s.medicationRow}>
															<span className={s.medName}>{med.name}{med.dosage ? ` - ${med.dosage}` : ''}</span>
															<button type="button" className={s.ratingTrigger}
																data-effectiveness={med.effectiveness ?? undefined}
																aria-expanded={ratingOpenId === med.id}
																aria-label={`${med.name}: ${med.effectiveness ? EFFECTIVENESS_LABELS[med.effectiveness] : 'Оценить'}`}
																onClick={() => setRatingOpenId(current => current === med.id ? null : med.id)}>
																{med.effectiveness ? EFFECTIVENESS_LABELS[med.effectiveness] : 'Оценить'}
															</button>
														</div>
														{ratingOpenId === med.id && <div className={s.ratingChoices}>
															{[1, 2, 3].map(value => (
																<button key={value} type="button" className={`${s.effectBtn} ${med.effectiveness === value ? s.effectBtnActive : ''}`}
																	data-effectiveness={value}
																	aria-pressed={med.effectiveness === value}
																	onClick={() => handleEffectiveness(med.id, value)}
																	data-help={`Оценить действие препарата «${med.name}»: ${EFFECTIVENESS_LABELS[value]}. Повторный выбор снимет оценку.`}>
																	{EFFECTIVENESS_LABELS[value]}
																</button>
															))}
														</div>}
													</div>
												))}
											</div>
										{attack && (
											<div className={s.attackLink}>
												{formatAttackOption(attack)}
											</div>
										)}
											{first.note && <p className={s.note}>{first.note}</p>}
										</div>
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
				deleteError={deleteError}
				loading={loading}
				deleting={deleting}
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
				onDelete={remove}
			/>
		</>
	)
}

export default MedicationSection
