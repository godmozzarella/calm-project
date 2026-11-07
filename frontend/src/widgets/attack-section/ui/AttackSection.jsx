import { useState, useCallback, useEffect, useRef } from 'react'
import AddIcon from '@mui/icons-material/Add'

import { StopCircleIcon } from '@/shared/ui/icons'
import { notifyError } from '@/shared/lib/notifyError'
import { isCentralError } from '@/shared/lib/isCentralError'
import { AddAttackForm, useAddAttack } from '@/features/add-attack'
import { formatAttackTime, getAttackTypeLabel, intensityColor, sortAttacksNewest } from '@/entities/attack'
import { attackApi } from '@/shared/api'
import { subscribe, ATTACKS_CHANGED, OPEN_ATTACK_FORM } from '@/shared/lib/dataEvents'
import { useDictionaries } from '@/shared/lib/dictionaries'

import s from './AttackSection.module.scss'

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const shortDate = iso => {
	const [, m, d] = iso.split('-')
	return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]}`
}

const formatRange = attack => {
	const startDate = attack.startDate ?? attack.date
	const endDate = attack.endDate ?? startDate
	const sameDay = startDate === endDate

	const startTime = formatAttackTime(attack.startTime)
	const endTime = formatAttackTime(attack.endTime)

	if (attack.ongoing) {
		return `${shortDate(startDate)}, ${startTime} — продолжается`
	}
	if (!endTime) {
		return `${shortDate(startDate)}, ${startTime}`
	}
	if (sameDay) {
		return `${shortDate(startDate)}, ${startTime} — ${endTime}`
	}
	return `${shortDate(startDate)} ${startTime} — ${shortDate(endDate)} ${endTime}`
}

const formatTimeRange = attack => {
	const startTime = formatAttackTime(attack.startTime) || 'Время не указано'
	const endTime = formatAttackTime(attack.endTime)
	if (attack.ongoing) return `${startTime} — продолжается`
	if (!endTime) return startTime
	const startDate = attack.startDate ?? attack.date
	const endDate = attack.endDate ?? startDate
	return startDate === endDate ? `${startTime} — ${endTime}` : `${startTime} — ${shortDate(endDate)} ${endTime}`
}

const AttackSection = ({ date, onInitialReady }) => {
	const [attacks, setAttacks] = useState([])
	const [finishing, setFinishing] = useState({})
	const pending = useRef(new Set())
	const { getLabel } = useDictionaries()

	const reload = useCallback(
		() => attackApi.getByDate(date).then(list => setAttacks(sortAttacksNewest(list))),
		[date]
	)

	useEffect(() => {
		let active = true
		reload().catch(() => {}).finally(() => { if (active) onInitialReady?.('attacks') })
		return () => { active = false }
	}, [reload, onInitialReady])

	useEffect(() => subscribe(ATTACKS_CHANGED, reload), [reload])

	const { open, form, error, deleteError, loading, deleting, editingId, openForm, openEditForm, closeForm, setField, toggleArrayField, submit, remove } =
		useAddAttack({ date, onSuccess: reload })
	const current = new Date()
	const todayKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
	const futureDay = date > todayKey
	const openNew = () => { if (!futureDay) openForm() }
	useEffect(() => subscribe(OPEN_ATTACK_FORM, () => { if (!futureDay) openForm() }), [futureDay, openForm])

	const handleComplete = async id => {
		if (pending.current.has(id)) return
		pending.current.add(id)
		setFinishing(previous => ({ ...previous, [id]: true }))
		try {
			await attackApi.complete(id)
		} catch (err) {
			if (!isCentralError(err)) notifyError(err.message || 'Не удалось сохранить время окончания.', 'Не удалось завершить приступ')
		} finally {
			pending.current.delete(id)
			setFinishing(previous => ({ ...previous, [id]: false }))
		}
	}
	const handleCardClick = event => {
		if (!futureDay && !event.target.closest('button, a, input, select, textarea, [role=button], li')) openForm()
	}

	return (
		<>
			<div className={s.card} onClick={handleCardClick} data-help="Приступы: здесь можно записать новый приступ, а также посмотреть и изменить уже добавленные.">
				<div className={s.cardHeader}>
					<h2 className={s.title}>Приступы</h2>
					<button type="button" className={s.addBtn} onClick={openNew} disabled={futureDay} aria-label="Добавить приступ" data-help="Добавить приступ за выбранный день: укажите время, силу боли, симптомы и другие подробности.">
						<AddIcon fontSize="small" />
					</button>
				</div>

				<div className={s.cardBody}>
					{attacks.length === 0 ? (
						<div className={s.empty}>
							<p className={s.emptyText}>Приступов за день нет</p>
							<p className={s.emptyHint}>Интенсивность, симптомы, триггеры — всё будет здесь</p>
						</div>
					) : (
						<ul className={s.list}>
							{attacks.map(attack => (
								<li key={attack.id} className={`${s.attackRow} ${attack.ongoing ? s.withComplete : ''}`}>
									<div
										className={s.attackCard}
										role="button"
										tabIndex={finishing[attack.id] ? -1 : 0}
										aria-label={`Редактировать приступ: ${formatRange(attack)}`}
										aria-disabled={!!finishing[attack.id]}
										data-help="Открыть подробности и редактирование этого приступа."
										onClick={event => {
											event.stopPropagation()
											if (!pending.current.has(attack.id)) openEditForm(attack)
										}}
										onKeyDown={event => {
											if (event.key !== 'Enter' && event.key !== ' ') return
											event.preventDefault()
											event.stopPropagation()
											if (!pending.current.has(attack.id)) openEditForm(attack)
										}}
									>
										<div className={s.attackTop}>
											<div className={s.attackMeta}>
												<span className={s.attackDate}>{shortDate(attack.startDate ?? attack.date)}</span>
												<span className={s.attackTime}>
													{formatTimeRange(attack)}
												</span>
											</div>
											<div className={s.attackRight}>
												<span
													className={s.intensityBadge}
													style={{ color: intensityColor(attack.intensity) }}
													aria-label={`Уровень боли: ${attack.intensity} из 10`}
												>
													{attack.intensity}
												</span>
											</div>
										</div>

										<div className={s.attackDetails}>
											<span className={s.attackType}>{getAttackTypeLabel(attack.type)}</span>
										{attack.symptoms.length > 0 && (
											<div className={s.chips}>
												{attack.symptoms.map(sym => (
													<span key={sym} className={s.chip}>
														{getLabel('SYMPTOM', sym)}
													</span>
												))}
											</div>
										)}

										{attack.note && (
											<p className={s.note}>{attack.note}</p>
										)}
										</div>
									</div>
									{attack.ongoing && <button
										type="button"
										className={s.completeBtn}
										onClick={() => handleComplete(attack.id)}
										disabled={!!finishing[attack.id]}
										aria-label={finishing[attack.id] ? 'Сохраняем окончание приступа' : 'Завершить приступ сейчас'}
										aria-busy={!!finishing[attack.id]}
										title="Завершить приступ сейчас"
										data-help="Завершить продолжающийся приступ: дата и время окончания заполнятся текущими."
									>
										<StopCircleIcon style={{ fontSize: '2rem' }} />
									</button>}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			<AddAttackForm
				open={open}
				form={form}
				error={error}
				deleteError={deleteError}
				deleting={deleting}
				loading={loading}
				editing={!!editingId}
				onClose={closeForm}
				setField={setField}
				toggleArrayField={toggleArrayField}
				onSubmit={submit}
				onDelete={remove}
			/>
		</>
	)
}

export default AttackSection
