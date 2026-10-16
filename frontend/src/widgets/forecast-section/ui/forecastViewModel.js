import { formatPressure, formatPressureChange } from '../../../shared/lib/pressure.js'

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export const LEVEL_LABELS = { LOW: 'Низкий', MEDIUM: 'Повышенный', HIGH: 'Высокий' }

const dateParts = iso => {
	const [year, month, day] = iso.split('-').map(Number)
	return { year, month, day, date: new Date(year, month - 1, day) }
}

export const dayLabel = (iso, today) => today ? 'Сегодня' : WEEKDAYS[dateParts(iso).date.getDay()]
export const shortDate = iso => {
	const { month, day } = dateParts(iso)
	return `${day} ${SHORT_MONTHS[month - 1]}`
}
export const longDate = (iso, today) => {
	const { month, day } = dateParts(iso)
	return `${today ? 'Сегодня' : WEEKDAYS[dateParts(iso).date.getDay()]} · ${day} ${MONTHS[month - 1]}`
}

const kpContribution = kp => kp >= 7 ? 25 : kp >= 5 ? 15 : kp >= 4 ? 10 : 0
const pressureContribution = delta => {
	if (delta == null) return 0
	const absolute = Math.abs(delta)
	const base = absolute >= 7.5 ? 60 : absolute >= 5.3 ? 45 : absolute >= 3.8 ? 30 : absolute >= 2.3 ? 15 : 0
	return Math.round(base * (delta < 0 ? 1 : 0.6))
}
const humidityContribution = humidity => humidity > 85 ? 20 : humidity > 75 ? 10 : 0
const temperatureContribution = (min, max) => {
	if (min == null || max == null) return 0
	const range = max - min
	return range > 15 ? 20 : range > 10 ? 10 : 0
}
const intensity = points => points >= 25 ? 'Сильно' : points >= 15 ? 'Средне' : points >= 8 ? 'Заметно' : 'Слабо'

export const weatherTiles = inputs => {
	const pressure = pressureContribution(inputs.pressureDelta24hMmHg)
	const humidity = humidityContribution(inputs.humidity)
	const temperature = temperatureContribution(inputs.tempMin, inputs.tempMax)
	const kp = kpContribution(inputs.kpIndex)
	const range = inputs.tempMin != null && inputs.tempMax != null ? inputs.tempMax - inputs.tempMin : null
	return [
		{ key: 'pressure', label: 'Давление', value: formatPressure(inputs.pressureMmHg), status: inputs.pressureDelta24hMmHg == null ? 'нет данных за сутки' : `${formatPressureChange(inputs.pressureDelta24hMmHg)} за сутки · ${pressure ? (inputs.pressureDelta24hMmHg < 0 ? 'падение' : 'рост') : 'без резкого перепада'}`, alert: pressure > 0 },
		{ key: 'humidity', label: 'Влажность', value: inputs.humidity == null ? '—' : `${Math.round(inputs.humidity)}%`, status: inputs.humidity == null ? 'нет данных' : humidity ? 'повышенная' : 'без повышения', alert: humidity > 0 },
		{ key: 'temperature', label: 'Температура', value: inputs.tempMin == null || inputs.tempMax == null ? '—' : `${Math.round(inputs.tempMin)}…${Math.round(inputs.tempMax)}°C`, status: range == null ? 'нет данных' : temperature ? `перепад ${Math.round(range)}°C` : 'без резкого перепада', alert: temperature > 0 },
		{ key: 'wind', label: 'Ветер до', value: inputs.windKmhMax == null ? '—' : `${Math.round(inputs.windKmhMax)} км/ч`, status: inputs.windKmhMax == null ? 'нет данных' : 'максимум за день', alert: false },
		{ key: 'kp', label: 'Kp-индекс', value: inputs.kpIndex == null ? '—' : inputs.kpIndex.toFixed(1), status: inputs.kpIndex == null ? 'нет данных' : inputs.kpIndex >= 5 ? 'магнитная буря' : inputs.kpIndex >= 4 ? 'повышенная активность' : 'спокойно', alert: kp > 0 },
	]
}

export const riskFactors = risk => {
	if (!risk?.dataAvailable) return []
	const i = risk.inputs || {}
	const pressure = pressureContribution(i.pressureDelta24hMmHg)
	const humidity = humidityContribution(i.humidity)
	const temperature = temperatureContribution(i.tempMin, i.tempMax)
	const kp = kpContribution(i.kpIndex)
	// Погодная модель ограничивает сумму сотней после Kp. Сохраняем тот же порядок
	// слагаемых, чтобы полоски не приписывали баллы, отрезанные ограничением.
	const weather = Math.min(i.weatherScore ?? 0, pressure + humidity + temperature)
	const magnetic = Math.min(kp, Math.max(0, (i.weatherScore ?? 0) - weather))
	const history = (risk.reasons || []).reduce((sum, reason) => {
		if (reason === 'Приступ был вчера') return sum + 15
		if (reason === 'Несколько приступов за последние 3 дня') return sum + 10
		if (reason === 'Частые приступы за последнюю неделю') return sum + Math.min(12, i.attacksLast7Days * 3)
		if (reason === 'Частый приём препаратов за последние 7 дней') return sum + 6
		if (reason === 'Есть сигнал риска medication overuse') return sum + 10
		return sum
	}, 0) + Math.min(20, (risk.personalFactors || []).length * 5)
	const pressureText = i.pressureDelta24hMmHg == null ? null : `давление ${formatPressureChange(i.pressureDelta24hMmHg)} за сутки`
	const tempText = i.tempMin == null || i.tempMax == null ? null : `перепад температуры ${Math.round(i.tempMax - i.tempMin)}°C`
	const weatherFacts = [pressure > 0 ? pressureText : null, temperature > 0 ? tempText : null, humidity > 0 ? `влажность ${Math.round(i.humidity)}%` : null, `погодный риск ${i.weatherScore ?? 0}/100`].filter(Boolean)
	return [
		{ key: 'history', title: 'Ваша история', points: history, detail: `${i.attacksLast3Days} ${plural(i.attacksLast3Days, 'день', 'дня', 'дней')} с приступом за 3 дня · ${i.attacksLast7Days} за неделю` },
		{ key: 'weather', title: 'Погода', points: weather, detail: weatherFacts.join(' · ') },
		{ key: 'magnetic', title: 'Магнитные бури', points: magnetic, detail: `Kp ${i.kpIndex?.toFixed(1) ?? '—'}` },
	].filter(factor => factor.points > 0 && (factor.key !== 'history' || risk.historyLevel !== 'LOW'))
		.sort((a, b) => b.points - a.points)
		.map(factor => ({ ...factor, intensity: intensity(factor.points) }))
}

function plural(value, one, few, many) {
	const mod10 = value % 10
	const mod100 = value % 100
	return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many
}

export const conclusion = (risk, factors, today) => {
	if (!risk?.dataAvailable) return risk?.message || 'Для выбранного дня оценка пока недоступна.'
	const day = today ? 'Сегодня' : 'В этот день'
	const lead = risk.level === 'LOW' ? `${day} оценка риска низкая.` : `${day} оценка риска ${risk.level === 'HIGH' ? 'высокая' : 'повышена'}.`
	if (!factors.length) return lead
	const names = { history: 'недавние приступы', weather: 'погода', magnetic: 'геомагнитная активность' }
	return `${lead} Главный фактор — ${names[factors[0].key]}${factors[1] ? `, также влияет ${names[factors[1].key]}` : ''}.`
}

export const helpfulMedication = medications => {
	const counts = new Map()
	for (const med of medications || []) {
		if (med.effectiveness !== 3 || !med.name?.trim()) continue
		const key = med.name.trim()
		counts.set(key, (counts.get(key) || 0) + 1)
	}
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

export const advice = (risk, medication) => {
	if (risk?.level === 'LOW') return ['Сохраняйте привычный режим сна, еды и воды.', 'Отмечайте приступы и самочувствие, чтобы накопить историю.']
	return [medication ? `Держите под рукой ${medication} — по вашим записям он помогал раньше.` : 'Держите под рукой назначенное вам средство, если оно есть.', 'Не пропускайте сон, еду и воду.', 'Вечером отметьте самочувствие в дневнике.']
}
