/**
 * Тонкая шина событий поверх window, чтобы виджеты могли реагировать
 * на изменения в localStorage (которое не шлёт `storage` event в той же вкладке).
 *
 * Storage-функции вызывают `emit(...)` после успешной записи,
 * а виджеты подписываются через `subscribe(...)` в useEffect.
 */

export const PROFILE_CHANGED = 'calm:profile-changed'
export const SURVEY_COMPLETED = 'calm:survey-completed'
export const SURVEY_CLOSED = 'calm:survey-closed'
export const OPEN_DAILY_QUESTIONNAIRE = 'calm:open-daily-questionnaire'
export const ATTACKS_CHANGED = 'calm:attacks-changed'
export const MEDICATIONS_CHANGED = 'calm:medications-changed'
export const OUTCOMES_CHANGED = 'calm:outcomes-changed'
export const ZONES_CHANGED = 'calm:zones-changed'
export const DATE_SELECTED = 'calm:date-selected'
export const AUTH_CHANGED = 'calm:auth-changed'
export const OPEN_ATTACK_FORM = 'calm:open-attack-form'

export const emit = (name, detail) => {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new CustomEvent(name, detail !== undefined ? { detail } : undefined))
}

export const subscribe = (name, handler) => {
	if (typeof window === 'undefined') return () => {}
	window.addEventListener(name, handler)
	return () => window.removeEventListener(name, handler)
}
