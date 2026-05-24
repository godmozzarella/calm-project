export const ATTACK_TYPE_LABELS = {
	pulsating: 'Пульсирующая',
	pressing:  'Давящая',
	stabbing:  'Стреляющая',
	bursting:  'Распирающая',
}

export const SYMPTOM_LABELS = {
	nausea:    'Тошнота',
	light:     'Светобоязнь',
	sound:     'Звукобоязнь',
	aura:      'Аура',
	dizziness: 'Головокружение',
}

export const TRIGGER_LABELS = {
	stress:   'Стресс',
	sleep:    'Сон',
	food:     'Еда',
	weather:  'Погода',
	screen:   'Экран',
	hormones: 'Гормоны',
	alcohol:  'Алкоголь',
}

export const intensityColor = v => {
	if (v <= 3) return '#22c55e'
	if (v <= 5) return '#eab308'
	if (v <= 7) return '#f97316'
	return '#ef4444'
}
