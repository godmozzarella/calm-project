const KEY = 'calm_attacks'

const generateId = () => {
	if (typeof crypto !== 'undefined') {
		if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
		if (typeof crypto.getRandomValues === 'function') {
			const bytes = new Uint8Array(16)
			crypto.getRandomValues(bytes)
			bytes[6] = (bytes[6] & 0x0f) | 0x40
			bytes[8] = (bytes[8] & 0x3f) | 0x80
			const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'))
			return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
		}
	}
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const readAll = () => {
	try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
	catch { return [] }
}

const writeAll = attacks => localStorage.setItem(KEY, JSON.stringify(attacks))

/** Все приступы, которые захватывают конкретный день (формат 'YYYY-MM-DD') */
export const getAttacksByDate = date =>
	readAll().filter(a => {
		const start = a.startDate ?? a.date
		const end = a.ongoing ? date : (a.endDate ?? a.startDate ?? a.date)
		return start <= date && date <= end
	})

/** Все приступы (для аналитики) */
export const getAllAttacks = () => readAll()

/** Все приступы, чей диапазон пересекает период [from, to] (формат 'YYYY-MM-DD') */
export const getAttacksInRange = (from, to) =>
	readAll().filter(a => {
		const start = a.startDate ?? a.date
		const end = a.ongoing ? to : (a.endDate ?? a.startDate ?? a.date)
		return start <= to && end >= from
	})

/** Добавить приступ */
export const addAttack = attack => {
	const all = readAll()
	const newAttack = { ...attack, id: generateId(), createdAt: new Date().toISOString() }
	writeAll([...all, newAttack])
	return newAttack
}

/** Обновить приступ по id */
export const updateAttack = (id, patch) => {
	const all = readAll()
	const updated = all.map(a => a.id === id ? { ...a, ...patch } : a)
	writeAll(updated)
	return updated.find(a => a.id === id)
}

/** Удалить приступ по id */
export const deleteAttack = id => {
	const all = readAll().filter(a => a.id !== id)
	writeAll(all)
}
