export const roundedPressure = mmHg => Math.round(mmHg)

export const formatPressure = mmHg => mmHg == null ? '—' : `${roundedPressure(mmHg)} мм рт. ст.`

export const formatPressureChange = mmHg => {
	if (mmHg == null) return '—'
	const value = Math.round(mmHg * 10) / 10
	const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
	return `${value > 0 ? '+' : ''}${formatted} мм рт. ст.`
}
