export const ATTACK_TYPE_LABELS = {
	pulsating: 'Пульсирующая',
	pressing:  'Давящая',
	stabbing:  'Стреляющая',
	bursting:  'Распирающая',
}

export const getAttackTypeLabel = type => ATTACK_TYPE_LABELS[String(type ?? '').toLowerCase()] ?? 'Не указан'

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

export const intensityColor = v => {
	if (v <= 3) return '#22c55e'
	if (v <= 5) return '#eab308'
	if (v <= 7) return '#f97316'
	return 'var(--error-color)'
}
