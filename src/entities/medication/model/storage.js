import { generateId } from '@/shared/lib/generateId'
import { emit, MEDICATIONS_CHANGED } from '@/shared/lib/dataEvents'

const KEY = 'calm_medications'

const readAll = () => {
	try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
	catch { return [] }
}

const writeAll = list => {
	localStorage.setItem(KEY, JSON.stringify(list))
	emit(MEDICATIONS_CHANGED)
}

/** Препараты за конкретный день ('YYYY-MM-DD'), отсортированные по времени */
export const getMedicationsByDate = date =>
	readAll()
		.filter(m => m.date === date)
		.sort((a, b) => a.time.localeCompare(b.time))

/** Все записи (для аналитики и статистики) */
export const getAllMedications = () => readAll()

/** Добавить запись */
export const addMedication = med => {
	const all = readAll()
	const newMed = { ...med, id: generateId(), createdAt: new Date().toISOString() }
	writeAll([...all, newMed])
	return newMed
}

/** Обновить запись (используется для выставления effectiveness) */
export const updateMedication = (id, patch) => {
	const updated = readAll().map(m => m.id === id ? { ...m, ...patch } : m)
	writeAll(updated)
	return updated.find(m => m.id === id)
}

/** Удалить запись */
export const deleteMedication = id => {
	writeAll(readAll().filter(m => m.id !== id))
}

/**
 * Количество уникальных дней в заданном месяце, когда принимались препараты.
 * Используется для детекции абузуса (>10 дней/месяц = риск).
 */
export const getOveruseDaysInMonth = (year, month) => {
	const days = new Set(
		readAll()
			.filter(m => {
				const [y, mo] = m.date.split('-').map(Number)
				return y === year && mo === month
			})
			.map(m => m.date)
	)
	return days.size
}

/**
 * Препараты в диапазоне дат ['YYYY-MM-DD', 'YYYY-MM-DD'].
 * Нужна чарту и статистике.
 */
export const getMedicationsInRange = (from, to) =>
	readAll()
		.filter(m => m.date >= from && m.date <= to)
		.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
