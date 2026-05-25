/**
 * Агрегация приступов в столбики графика.
 *
 * Один bucket = { key, label, fromDate, toDate, maxIntensity, count, dateKey? }
 *  - key:           уникальный id столбика
 *  - label:         подпись для оси X (короткая)
 *  - dateKey:       'YYYY-MM-DD' если бакет = 1 день (для клика → DayBar)
 *  - maxIntensity:  максимальная интенсивность среди приступов бакета (0 если пусто)
 *  - count:         количество приступов в бакете
 *
 * Период:
 *   week     — 7 дней назад от сегодня, по дням
 *   month    — 30 дней назад,   по дням
 *   3months  — 90 дней назад,   по дням
 *   year     — 52 недели назад, по неделям
 *   all      — от самого раннего приступа до сегодня:
 *              если <60 дней — по дням, если <2 лет — по неделям, иначе — по месяцам
 */

const MS_DAY = 86_400_000

const pad = n => String(n).padStart(2, '0')

const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const startOfDay = d => {
	const c = new Date(d)
	c.setHours(0, 0, 0, 0)
	return c
}

const addDays = (d, n) => {
	const c = new Date(d)
	c.setDate(c.getDate() + n)
	return c
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** Сравнивает только дату (без времени) с диапазоном [from, to] включительно. */
const dayInRange = (key, fromKey, toKey) => key >= fromKey && key <= toKey

/** Создать пустые бакеты по дням от fromDate до toDate включительно. */
const makeDayBuckets = (fromDate, toDate) => {
	const buckets = []
	let cur = startOfDay(fromDate)
	const end = startOfDay(toDate)
	while (cur.getTime() <= end.getTime()) {
		const key = toKey(cur)
		buckets.push({
			key,
			dateKey: key,
			label: `${cur.getDate()}`,
			fromKey: key,
			toKey: key,
			maxIntensity: 0,
			count: 0,
			_date: new Date(cur),
		})
		cur = addDays(cur, 1)
	}
	return buckets
}

/** Бакеты по неделям. fromDate округляется к понедельнику. */
const makeWeekBuckets = (fromDate, toDate) => {
	const start = startOfDay(fromDate)
	const dow = start.getDay() === 0 ? 6 : start.getDay() - 1
	start.setDate(start.getDate() - dow)
	const buckets = []
	let cur = start
	const end = startOfDay(toDate)
	while (cur.getTime() <= end.getTime()) {
		const last = addDays(cur, 6)
		buckets.push({
			key: toKey(cur),
			label: `${cur.getDate()} ${MONTHS_SHORT[cur.getMonth()]}`,
			fromKey: toKey(cur),
			toKey: toKey(last),
			maxIntensity: 0,
			count: 0,
			_date: new Date(cur),
		})
		cur = addDays(cur, 7)
	}
	return buckets
}

/** Бакеты по месяцам. */
const makeMonthBuckets = (fromDate, toDate) => {
	const start = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
	const end = startOfDay(toDate)
	const buckets = []
	let cur = start
	while (cur.getTime() <= end.getTime()) {
		const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
		const lastDay = new Date(next.getTime() - MS_DAY)
		buckets.push({
			key: toKey(cur),
			label: MONTHS_SHORT[cur.getMonth()],
			fromKey: toKey(cur),
			toKey: toKey(lastDay),
			maxIntensity: 0,
			count: 0,
			_date: new Date(cur),
		})
		cur = next
	}
	return buckets
}

/**
 * Распределить приступы по бакетам. Приступ относится к бакету по startDate.
 */
const fillBuckets = (buckets, attacks) => {
	if (buckets.length === 0) return buckets
	const minKey = buckets[0].fromKey
	const maxKey = buckets[buckets.length - 1].toKey

	for (const a of attacks) {
		const key = a.startDate ?? a.date
		if (!key || !dayInRange(key, minKey, maxKey)) continue
		const bucket = buckets.find(b => dayInRange(key, b.fromKey, b.toKey))
		if (!bucket) continue
		bucket.count += 1
		if (a.intensity > bucket.maxIntensity) bucket.maxIntensity = a.intensity
	}
	return buckets
}

/** Период → конфигурация бакетов. */
export const buildBuckets = (period, attacks) => {
	const today = startOfDay(new Date())

	if (period === 'week') {
		return fillBuckets(makeDayBuckets(addDays(today, -6), today), attacks)
	}
	if (period === 'month') {
		return fillBuckets(makeDayBuckets(addDays(today, -29), today), attacks)
	}
	if (period === '3months') {
		return fillBuckets(makeDayBuckets(addDays(today, -89), today), attacks)
	}
	if (period === 'year') {
		return fillBuckets(makeWeekBuckets(addDays(today, -7 * 51), today), attacks)
	}
	if (period === 'all') {
		if (attacks.length === 0) {
			return fillBuckets(makeDayBuckets(addDays(today, -29), today), attacks)
		}
		const earliest = attacks.reduce((min, a) => {
			const k = a.startDate ?? a.date
			return k && k < min ? k : min
		}, '9999-12-31')
		const [y, m, d] = earliest.split('-').map(Number)
		const from = new Date(y, m - 1, d)
		const days = Math.round((today - from) / MS_DAY) + 1
		if (days <= 60) return fillBuckets(makeDayBuckets(from, today), attacks)
		if (days <= 730) return fillBuckets(makeWeekBuckets(from, today), attacks)
		return fillBuckets(makeMonthBuckets(from, today), attacks)
	}
	return []
}

export const PERIOD_OPTIONS = [
	{ value: 'week',     label: 'Неделя'   },
	{ value: 'month',    label: 'Месяц'    },
	{ value: '3months',  label: '3 месяца' },
	{ value: 'year',     label: 'Год'      },
	{ value: 'all',      label: 'Всё'      },
]

export const METRIC_OPTIONS = [
	{ value: 'intensity', label: 'Интенсивность' },
	{ value: 'count',     label: 'Количество'    },
]

/** Подписи под осью X — каждый N-ый бакет, чтобы не было каши. */
export const pickLabelIndices = (count) => {
	if (count <= 0) return new Set()
	const target = 8 // примерно столько подписей хотим видеть
	const step = Math.max(1, Math.ceil(count / target))
	const set = new Set()
	for (let i = 0; i < count; i += step) set.add(i)
	set.add(count - 1)
	return set
}
