import { useState, useCallback, useEffect } from 'react'

import { AddIcon, DeleteIcon } from '@/shared/ui/icons'
import { AddMedicationForm, useAddMedication } from '@/features/add-medication'
import {
	getMedicationsByDate,
	deleteMedication,
	updateMedication,
	getOveruseDaysInMonth,
	EFFECTIVENESS_LABELS,
	OVERUSE_THRESHOLD,
} from '@/entities/medication'
import { getAttacksByDate, ATTACK_TYPE_LABELS } from '@/entities/attack'

import s from './MedicationSection.module.scss'

const EFFECTIVENESS_COLORS = { 1: '#ef4444', 2: '#eab308', 3: '#22c55e' }

const MedicationSection = ({ date }) => {
	const [medications, setMedications] = useState(() => getMedicationsByDate(date))
	const [attacks,     setAttacks]     = useState(() => getAttacksByDate(date))
	const [overuseDays, setOveruseDays] = useState(0)

	const reload = useCallback(() => {
		setMedications(getMedicationsByDate(date))
		setAttacks(getAttacksByDate(date))
		const [year, month] = date.split('-').map(Number)
		setOveruseDays(getOveruseDaysInMonth(year, month))
	}, [date])

	useEffect(() => { reload() }, [reload])

	const {
		open, step, selected, meta, error,
		openForm, closeForm,
		toggleItem, isSelected, setItemDosage,
		setMetaField, nextStep, prevStep, submit,
	} = useAddMedication({ date, onSuccess: reload })

	const handleDelete = id => {
		deleteMedication(id)
		reload()
	}

	const handleEffectiveness = (id, value) => {
		updateMedication(id, { effectiveness: value })
		reload()
	}

	const linkedAttack = attackId => attacks.find(a => a.id === attackId)

	return (
		<>
			<div className={s.card}>
				<div className={s.cardHeader}>
					<h2 className={s.title}>Препараты</h2>
					<button className={s.addBtn} onClick={openForm} aria-label="Добавить препарат">
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
												<span className={s.medTime}>{med.time}</span>
												<button
													className={s.deleteBtn}
													onClick={() => handleDelete(med.id)}
													aria-label="Удалить"
												>
													<DeleteIcon style={{ fontSize: '1rem' }} />
												</button>
											</div>
										</div>

										{attack && (
											<div className={s.attackLink}>
												Приступ {attack.startTime}
												{attack.endTime ? ` — ${attack.endTime}` : attack.ongoing ? ' — сейчас' : ''}
												{' · '}{ATTACK_TYPE_LABELS[attack.type]}
												{' · '}{attack.intensity}/10
											</div>
										)}

										<div className={s.effectivenessRow}>
											{[1, 2, 3].map(v => (
												<button
													key={v}
													className={`${s.effectBtn} ${med.effectiveness === v ? s.effectBtnActive : ''}`}
													style={med.effectiveness === v ? { color: EFFECTIVENESS_COLORS[v], borderColor: EFFECTIVENESS_COLORS[v] } : {}}
													onClick={() => handleEffectiveness(med.id, med.effectiveness === v ? null : v)}
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
				attacks={attacks}
				onClose={closeForm}
				toggleItem={toggleItem}
				isSelected={isSelected}
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
