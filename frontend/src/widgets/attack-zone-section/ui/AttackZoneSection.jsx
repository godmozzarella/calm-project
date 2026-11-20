import { useState, useEffect } from 'react'
import { formatAttackTime, PAIN_ZONE_LABELS, sortAttacksNewest, toZoneMap } from '@/entities/attack'
import { attackApi } from '@/shared/api'
import { EditIcon } from '@/shared/ui/icons'
import { notifyRequestError } from '@/shared/lib/notifyError'
import HeadDiagram from './HeadDiagram'
import { subscribe, ATTACKS_CHANGED } from '@/shared/lib/dataEvents'
import s from './AttackZoneSection.module.scss'

// green → yellow → red → remove
const CYCLE = { green: 'yellow', yellow: 'red', red: null }

const cycleZone = (zones, zone) => {
	const current = zones[zone] ?? null
	const next = current === null ? 'green' : CYCLE[current]
	if (next === null) {
		const { [zone]: _, ...rest } = zones
		return rest
	}
	return { ...zones, [zone]: next }
}

const MONTH_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'ноя.', 'дек.']
const shortDate = value => {
	const [, month, day] = String(value ?? '').split('-')
	return MONTH_SHORT[Number(month) - 1] && Number(day) ? `${Number(day)} ${MONTH_SHORT[Number(month) - 1]}` : ''
}
const fmtAttack = attack => {
	const startDate = attack.startDate ?? attack.date
	const start = `${shortDate(startDate)} ${formatAttackTime(attack.startTime) || 'время не указано'}`.trim()
	const endTime = formatAttackTime(attack.endTime)
	const endDate = attack.endDate ?? startDate
	const end = attack.ongoing ? 'продолжается' : endTime ? `${endDate !== startDate ? `${shortDate(endDate)} ` : ''}${endTime}` : ''
	return `${start}${end ? ` - ${end}` : ''}, ${attack.intensity}`
}

const AttackZoneSection = ({ date, onInitialReady }) => {
	const [attacks,    setAttacks]    = useState([])
	const [selectedId, setSelectedId] = useState(null)   // null = без привязки
	const [zones,      setZones]      = useState({})     // { zone: 'green'|'yellow'|'red' }
	const [editing, setEditing] = useState(false)
	const [saving, setSaving] = useState(false)

	// При смене дня сначала показываем текущий приступ, затем самые свежие.
	useEffect(() => {
		let active = true
		attackApi.getByDate(date).then(list => {
			if (!active) return
			const sorted = sortAttacksNewest(list)
			setAttacks(sorted)
			setSelectedId(sorted[0]?.id ?? null)
			setZones(toZoneMap(sorted[0]?.painZones))
			setEditing(false)
		}).catch(() => {}).finally(() => { if (active) onInitialReady?.('zones') })
		return () => { active = false }
	}, [date, onInitialReady])

	// Эффект 1b: при внешнем добавлении/удалении приступа — перечитать список
	useEffect(() => subscribe(ATTACKS_CHANGED, () => {
		attackApi.getByDate(date).then(list => {
			const sorted = sortAttacksNewest(list)
			setAttacks(sorted)
			const selected = sorted.find(a => a.id === selectedId) ?? sorted[0]
			setSelectedId(selected?.id ?? null)
			setZones(toZoneMap(selected?.painZones))
			if (!selected || selected.id !== selectedId) setEditing(false)
		})
	}), [date, selectedId])

	const selectAttack = id => {
		if (id === selectedId) return
		setSelectedId(id)
		setZones(toZoneMap(attacks.find(a => a.id === id)?.painZones))
		setEditing(false)
	}

	const saveZones = async () => {
		const attack = attacks.find(a => a.id === selectedId)
		if (!attack || saving) return
		setSaving(true)
		try {
			await attackApi.update(selectedId, { ...attack, painZones: zones })
			setEditing(false)
		} catch (e) {
			notifyRequestError(e, 'Не удалось сохранить зоны боли')
		} finally { setSaving(false) }
	}

	// Зоны боли привязаны к приступам — без приступа отмечать нечего.
	const hasAttacks = attacks.length > 0

	const toggleZone = zone => {
		if (!hasAttacks || !editing) return
		const next = cycleZone(zones, zone)
		setZones(next)
	}

	const removeZone = zone => {
		if (!hasAttacks || !editing) return
		setZones(previous => {
			const { [zone]: _, ...remaining } = previous
			return remaining
		})
	}

	const clearAll = () => {
		if (!hasAttacks || !editing) return
		setZones({})
	}

	const zoneCount = Object.keys(zones).length

	return (
		<div className={s.card} title="Зоны боли: отметьте на рисунке головы места, где болело во время выбранного приступа.">
			<div className={s.cardHeader} data-tour="zones">
				<h2 className={s.title}>Зоны боли</h2>
				{editing && zoneCount > 0 && (
					<button className={s.clearBtn} onClick={clearAll} title="Убрать все отмеченные зоны боли для выбранного приступа.">Сбросить</button>
				)}
				{hasAttacks && !editing && <button className={s.editBtn} onClick={() => setEditing(true)} aria-label="Редактировать зоны боли" title="Отметить или изменить зоны боли для выбранного приступа."><EditIcon fontSize="small" /></button>}
				{editing && <div className={s.editActions}>
					<button onClick={() => { setZones(toZoneMap(attacks.find(a => a.id === selectedId)?.painZones)); setEditing(false) }} disabled={saving} title="Отменить изменения зон боли.">Отмена</button>
					<button onClick={saveZones} disabled={saving} title="Сохранить отмеченные зоны боли в записи приступа.">{saving ? 'Сохраняем…' : 'Готово'}</button>
				</div>}
			</div>

			<div className={`${s.cardBody} ${!hasAttacks ? s.cardBodyDisabled : ''}`}>
				{!hasAttacks && (
					<p className={s.emptyHint}>
						Сначала добавьте приступ за этот день — тогда можно будет отметить зоны боли.
					</p>
				)}
				{/* Attack selector */}
				{attacks.length > 0 && (
					<div className={s.attackSelector}>
						<span className={s.selectorLabel}>Приступ</span>
						<div className={s.attackPills}>
							{attacks.map(a => (
								<button
									key={a.id}
									aria-pressed={selectedId === a.id}
									aria-label={`Выбрать приступ: ${fmtAttack(a)}. Интенсивность ${a.intensity} из 10`}
									className={`${s.attackPill} ${selectedId === a.id ? s.attackPillActive : ''}`}
									onClick={() => selectAttack(a.id)}
									title="Выбрать приступ, для которого нужно посмотреть или изменить зоны боли."
								>
									{fmtAttack(a)}
								</button>
							))}
						</div>
					</div>
				)}

				{/* Head visualizations */}
				<div className={`${s.headsRow} ${!hasAttacks ? s.headsRowMuted : ''}`} aria-disabled={!hasAttacks}>
					<div className={s.headView}>
						<HeadDiagram zones={zones} onToggle={toggleZone} readOnly={!editing} />
						<span className={s.headLabel}>Спереди</span>
					</div>
					<div className={s.dividerV} />
					<div className={s.headView}>
						<HeadDiagram rear zones={zones} onToggle={toggleZone} readOnly={!editing} />
						<span className={s.headLabel}>Сзади</span>
					</div>
				</div>

				{/* Zone tags + hint */}
				{zoneCount > 0 ? (
					<>
						<div className={s.zoneTags}>
							{Object.entries(zones).map(([zone, color]) => (
								<button
									key={zone}
									type="button"
									className={`${s.zoneTag} ${s[`zoneTag_${color}`]}`}
									onClick={() => removeZone(zone)}
									disabled={!editing}
									title={editing ? `Снять отметку с зоны «${PAIN_ZONE_LABELS[zone]}».` : `Зона боли: ${PAIN_ZONE_LABELS[zone]}.`}
									aria-label={editing ? `Снять отметку с зоны «${PAIN_ZONE_LABELS[zone]}»` : undefined}
								>
									<span className={`${s.zoneDot} ${s[`dot_${color}`]}`} />
									{PAIN_ZONE_LABELS[zone]}
									{editing && <span className={s.zoneTagX} aria-hidden="true">✕</span>}
								</button>
							))}
						</div>
						{editing && <p className={s.intensityHint}>Нажмите на схему, чтобы изменить интенсивность, или на метку, чтобы снять отметку.</p>}
					</>
				) : (
					<>
						<p className={s.hint}>{editing ? 'Нажмите на область, чтобы отметить зону боли' : 'Нажмите карандаш, чтобы отметить зоны боли'}</p>
						<div className={s.legend}>
							<span className={s.legendItem}><span className={`${s.legendDot} ${s.dot_green}`} />Слабая</span>
							<span className={s.legendItem}><span className={`${s.legendDot} ${s.dot_yellow}`} />Умеренная</span>
							<span className={s.legendItem}><span className={`${s.legendDot} ${s.dot_red}`} />Сильная</span>
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default AttackZoneSection
