/**
 * Встроенный пресет популярных препаратов, сгруппированных по форме выпуска.
 * При появлении бэка заменяется на GET /api/medications/catalog,
 * свободный ввод остаётся как fallback.
 */
export const MEDICATION_PRESETS = [
	{
		category: 'Таблетки',
		items: [
			{ name: 'Суматриптан',  dosage: '50'  },
			{ name: 'Золмитриптан', dosage: '2.5' },
			{ name: 'Элетриптан',   dosage: '40'  },
			{ name: 'Нурофен',      dosage: '400' },
			{ name: 'Ибупрофен',    dosage: '400' },
			{ name: 'Найз',         dosage: '100' },
			{ name: 'Аспирин',      dosage: '500' },
			{ name: 'Парацетамол',  dosage: '500' },
			{ name: 'Кетопрофен',   dosage: '100' },
		],
	},
	{
		category: 'Капсулы',
		items: [
			{ name: 'Нурофен Экспресс', dosage: '200' },
			{ name: 'Парацетамол',      dosage: '500' },
		],
	},
	{
		category: 'Растворимые / Порошок',
		items: [
			{ name: 'Аспирин УПСА',  dosage: '500' },
			{ name: 'Парацетамол',   dosage: '650' },
		],
	},
	{
		category: 'Назальный спрей',
		items: [
			{ name: 'Имигран спрей',      dosage: '20'  },
			{ name: 'Золмитриптан спрей', dosage: '2.5' },
		],
	},
	{
		category: 'Суппозитории',
		items: [
			{ name: 'Суматриптан', dosage: '25'  },
			{ name: 'Парацетамол', dosage: '500' },
		],
	},
]

export const EFFECTIVENESS_LABELS = {
	1: 'Не помогло',
	2: 'Частично',
	3: 'Помогло',
}

/** Порог дней в месяц для предупреждения об абузусе */
export const OVERUSE_THRESHOLD = 10
