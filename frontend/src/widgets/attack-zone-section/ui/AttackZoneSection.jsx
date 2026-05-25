import { useState, useEffect } from 'react'
import { PAIN_ZONE_LABELS, getZonesByDate, setZonesByDate, toZoneMap } from '@/entities/attack'
import { attackApi } from '@/shared/api'
import HeadFront from './HeadFront'
import HeadBack  from './HeadBack'
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

const fmtAttack = a =>
	`${a.startTime}${a.ongoing ? ' — сейчас' : a.endTime ? ` — ${a.endTime}` : ''} · ${a.intensity}/10`

const AttackZoneSection = ({ date }) => {
	const [attacks,    setAttacks]    = useState([])
	const [selectedId, setSelectedId] = useState(null)   // null = без привязки
	const [zones,      setZones]      = useState({})     // { zone: 'green'|'yellow'|'red' }

	// Эффект 1: смена даты — перезагрузить приступы, выбрать первый (если есть)
	useEffect(() => {
		attackApi.getByDate(date).then(list => {
			setAttacks(list)
			setSelectedId(list.length > 0 ? list[0].id : null)
		})
	}, [date])

	// Эффект 1b: при внешнем добавлении/удалении приступа — перечитать список
	useEffect(() => subscribe(ATTACKS_CHANGED, () => {
		attackApi.getByDate(date).then(list => {
			setAttacks(list)
			// Если выбранного приступа больше нет (или раньше не было) — переключаемся на первый.
			setSelectedId(prev => {
				if (list.length === 0) return null
				if (prev != null && list.some(a => a.id === prev)) return prev
				return list[0].id
			})
		})
	}), [date])

	// Эффект 2: смена выбранного приступа — загрузить зоны из него или из calm_zones
	useEffect(() => {
		if (selectedId === null) {
			setZones(getZonesByDate(date))
		} else {
			setAttacks(current => {
				const attack = current.find(a => a.id === selectedId)
				if (attack) {
					setZones(toZoneMap(attack.painZones))
				} else {
					// приступ удалён — откат к без привязки
					setSelectedId(null)
					setZones(getZonesByDate(date))
				}
				return current
			})
		}
	// date здесь нужна только при selectedId===null; attacks намеренно вне deps
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedId])

	const selectAttack = id => {
		if (id === selectedId) return
		setSelectedId(id)
		if (id === null) {
			setZones(getZonesByDate(date))
		} else {
			const attack = attacks.find(a => a.id === id)
			setZones(toZoneMap(attack?.painZones))
		}
	}

	const saveZones = (next, attackId) => {
		if (attackId) {
			const attack = attacks.find(a => a.id === attackId)
			if (!attack) return
			attackApi.update(attackId, { ...attack, painZones: next })
			setAttacks(prev => prev.map(a => a.id === attackId ? { ...a, painZones: next } : a))
		} else {
			setZonesByDate(date, next)
		}
	}

	// Зоны боли привязаны к приступам — без приступа отмечать нечего.
	const hasAttacks = attacks.length > 0

	const toggleZone = zone => {
		if (!hasAttacks) return
		const next = cycleZone(zones, zone)
		setZones(next)
		saveZones(next, selectedId)
	}

	const removeZone = (e, zone) => {
		e.stopPropagation()
		if (!hasAttacks) return
		const { [zone]: _, ...next } = zones
		setZones(next)
		saveZones(next, selectedId)
	}

	const clearAll = () => {
		if (!hasAttacks) return
		setZones({})
		saveZones({}, selectedId)
	}

	const zoneCount = Object.keys(zones).length

	return (
		<div className={s.card}>
			<div className={s.cardHeader}>
				<h2 className={s.title}>Зоны боли</h2>
				{zoneCount > 0 && (
					<button className={s.clearBtn} onClick={clearAll}>Сбросить</button>
				)}
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
									className={`${s.attackPill} ${selectedId === a.id ? s.attackPillActive : ''}`}
									onClick={() => selectAttack(a.id)}
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
						<HeadFront zones={zones} onToggle={toggleZone} />
						<span className={s.headLabel}>Спереди</span>
					</div>
					<div className={s.dividerV} />
					<div className={s.headView}>
						<HeadBack zones={zones} onToggle={toggleZone} />
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
									className={`${s.zoneTag} ${s[`zoneTag_${color}`]}`}
									onClick={() => toggleZone(zone)}
									title="Нажмите чтобы изменить интенсивность"
								>
									<span className={`${s.zoneDot} ${s[`dot_${color}`]}`} />
									{PAIN_ZONE_LABELS[zone]}
									<span className={s.zoneTagX} onClick={e => removeZone(e, zone)}>✕</span>
								</button>
							))}
						</div>
						<p className={s.intensityHint}>Нажмите зону чтобы изменить интенсивность</p>
					</>
				) : (
					<>
						<p className={s.hint}>Нажмите на область чтобы отметить зону боли</p>
						<div className={s.legend}>
							<span className={`${s.legendDot} ${s.dot_green}`}  /> Слабая
							<span className={`${s.legendDot} ${s.dot_yellow}`} /> Умеренная
							<span className={`${s.legendDot} ${s.dot_red}`}    /> Сильная
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default AttackZoneSection
