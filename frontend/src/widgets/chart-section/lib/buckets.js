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
