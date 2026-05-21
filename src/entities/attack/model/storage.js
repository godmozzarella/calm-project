const KEY = 'calm_attacks'

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
	const newAttack = { ...attack, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
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
