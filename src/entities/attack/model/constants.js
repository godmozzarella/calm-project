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

export const PAIN_ZONE_LABELS = {
	crown:         'Темя',
	forehead:      'Лоб',
	left_temple:   'Левый висок',
	right_temple:  'Правый висок',
	left_eye:      'Левый глаз',
	right_eye:     'Правый глаз',
	face:          'Лицо / пазухи',
	left_occiput:  'Затылок слева',
	right_occiput: 'Затылок справа',
	neck:          'Шея',
}

export const FRONT_ZONES  = ['crown', 'forehead', 'left_temple', 'right_temple', 'left_eye', 'right_eye', 'face']
export const BACK_ZONES   = ['crown', 'left_occiput', 'right_occiput', 'neck']

export const intensityColor = v => {
	if (v <= 3) return '#22c55e'
	if (v <= 5) return '#eab308'
	if (v <= 7) return '#f97316'
	return '#ef4444'
}
