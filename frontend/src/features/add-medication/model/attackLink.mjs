import { sortAttacksNewest } from '../../../entities/attack/model/sortAttacks.js'

const MONTHS = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.']
const shortDate = value => {
	const [, month, day] = String(value ?? '').split('-').map(Number)
	return day && month >= 1 && month <= 12 ? `${day} ${MONTHS[month - 1]}` : 'Дата не указана'
}
const shortTime = value => value ? String(value).slice(0, 5) : 'время не указано'

export const attacksForDate = (attacks, date) => {
	if (!date) return []
	return sortAttacksNewest(attacks.filter(attack => {
		const startDate = attack.startDate ?? attack.date
		if (!startDate || startDate > date) return false
		return attack.ongoing || (attack.endDate ?? startDate) >= date
	}))
}

export const defaultAttackId = (attacks, date) => attacksForDate(attacks, date)[0]?.id ?? null

export const formatAttackOption = attack => {
	const startDate = attack.startDate ?? attack.date
	const start = `${shortDate(startDate)} ${shortTime(attack.startTime)}`
	let end = ''
	if (attack.ongoing) end = ' - продолжается'
	else if (attack.endTime) {
		const endDate = attack.endDate ?? startDate
		end = ` - ${endDate === startDate ? '' : `${shortDate(endDate)} `}${shortTime(attack.endTime)}`
	}
	return `${start}${end}, ${attack.intensity ?? '—'}`
}
