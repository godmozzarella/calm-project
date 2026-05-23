/**
 * Производные метрики для KPI-плиток поверх графика.
 * Считает по тому же массиву приступов и набору бакетов, что и сам график,
 * чтобы цифры всегда совпадали с тем, что нарисовано.
 */

import { getOveruseDaysInMonth, OVERUSE_THRESHOLD } from '@/entities/medication'
import { TRIGGER_LABELS, SYMPTOM_LABELS } from '@/entities/attack'

const pad = n => String(n).padStart(2, '0')
const toDateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const inRange = (key, from, to) => !!key && key >= from && key <= to

/**
 * Самая длинная серия дней без приступов внутри [fromKey, toKey].
 * Считаем по дням (даже если бакеты — недели/месяцы),
 * чтобы метрика была одинаково осмысленной на любом периоде.
 */
const longestNoPainStreak = (attacks, fromKey, toKey) => {
	if (!fromKey || !toKey) return 0

	// в какие дни приступы фиксировались (start-date)
	const hasPain = new Set()
	for (const a of attacks) {
		const k = a.startDate ?? a.date
		if (inRange(k, fromKey, toKey)) hasPain.add(k)
	}

	const [fy, fm, fd] = fromKey.split('-').map(Number)
	const [ty, tm, td] = toKey.split('-').map(Number)
	const cur = new Date(fy, fm - 1, fd)
	const end = new Date(ty, tm - 1, td)

	let best = 0
	let run = 0
	while (cur.getTime() <= end.getTime()) {
		if (hasPain.has(toDateKey(cur))) {
			run = 0
		} else {
			run += 1
			if (run > best) best = run
		}
		cur.setDate(cur.getDate() + 1)
	}
	return best
}

export const computeKpis = (attacks, buckets) => {
	const fromKey = buckets[0]?.fromKey ?? null
	const toKey = buckets[buckets.length - 1]?.toKey ?? null

	const total = buckets.reduce((s, b) => s + b.count, 0)

	const attacksInRange = attacks.filter(a => inRange(a.startDate ?? a.date, fromKey, toKey))
	const intensities = attacksInRange.map(a => a.intensity).filter(v => typeof v === 'number')
	const avgIntensity = intensities.length > 0
		? intensities.reduce((s, v) => s + v, 0) / intensities.length
		: 0

	const streak = longestNoPainStreak(attacksInRange, fromKey, toKey)

	const now = new Date()
	const overuseDays = getOveruseDaysInMonth(now.getFullYear(), now.getMonth() + 1)
	const overuseRisk = overuseDays >= OVERUSE_THRESHOLD

	return { total, avgIntensity, streak, overuseDays, overuseRisk }
}

export { OVERUSE_THRESHOLD }

/* ───────────────────────────  Patterns (этап 3)  ─────────────────────────── */

/** Топ-N значений из массива массивов (e.g. attacks[].triggers). */
const topFromArrays = (attacks, field, labels, n = 5) => {
	const counts = new Map()
	for (const a of attacks) {
		const arr = a[field]
		if (!Array.isArray(arr)) continue
		for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1)
	}
	const total = attacks.length
	return [...counts.entries()]
		.map(([key, count]) => ({
			key,
			label: labels[key] ?? key,
			count,
			share: total > 0 ? count / total : 0,
		}))
		.sort((a, b) => b.count - a.count)
		.slice(0, n)
}

/**
 * Частота зон боли по приступам периода + map { zone → 'green'|'yellow'|'red' }
 * для отрисовки готовыми HeadFront/HeadBack.
 *
 * Алгоритм: считаем по `painZones` каждого приступа (внутри атаки зона может быть
 * green/yellow/red, но для агрегата нас интересует факт «зона участвовала» —
 * считаем 1 за приступ независимо от цвета внутри атаки). Затем нормируем по
 * максимуму и бакетизируем по перцентилям.
 */
const zonePatterns = (attacks) => {
	const freq = {}
	for (const a of attacks) {
		const pz = a.painZones
		if (!pz) continue
		// painZones может быть массивом строк (старый формат) или объектом { zone: color }
		const zones = Array.isArray(pz) ? pz : Object.keys(pz)
		const seen = new Set()
		for (const z of zones) {
			if (seen.has(z)) continue
			seen.add(z)
			freq[z] = (freq[z] ?? 0) + 1
		}
	}

	const max = Math.max(0, ...Object.values(freq))
	const colorMap = {}
	if (max > 0) {
		for (const [zone, n] of Object.entries(freq)) {
			const r = n / max
			colorMap[zone] = r >= 0.66 ? 'red' : r >= 0.33 ? 'yellow' : 'green'
		}
	}
	return { freq, colorMap, max }
}

/** Статистика по препаратам внутри периода: имя → { count, avgEff, withRating }. */
const medStats = (medications, fromKey, toKey) => {
	const inPeriod = medications.filter(m => inRange(m.date, fromKey, toKey))
	const byName = new Map()
	for (const m of inPeriod) {
		const cur = byName.get(m.name) ?? { name: m.name, count: 0, effSum: 0, effCount: 0 }
		cur.count += 1
		if (typeof m.effectiveness === 'number') {
			cur.effSum += m.effectiveness
			cur.effCount += 1
		}
		byName.set(m.name, cur)
	}
	return [...byName.values()]
		.map(m => ({
			name: m.name,
			count: m.count,
			avgEff: m.effCount > 0 ? m.effSum / m.effCount : null,
			withRating: m.effCount,
		}))
		.sort((a, b) => b.count - a.count)
}

export const computePatterns = (attacks, medications, buckets) => {
	const fromKey = buckets[0]?.fromKey ?? null
	const toKey = buckets[buckets.length - 1]?.toKey ?? null
	const attacksInRange = attacks.filter(a => inRange(a.startDate ?? a.date, fromKey, toKey))

	return {
		topTriggers: topFromArrays(attacksInRange, 'triggers', TRIGGER_LABELS),
		topSymptoms: topFromArrays(attacksInRange, 'symptoms', SYMPTOM_LABELS),
		zones: zonePatterns(attacksInRange),
		meds: medStats(medications, fromKey, toKey),
	}
}
