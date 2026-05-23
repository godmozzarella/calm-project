/**
 * Тонкая шина событий поверх window, чтобы виджеты могли реагировать
 * на изменения в localStorage (которое не шлёт `storage` event в той же вкладке).
 *
 * Storage-функции вызывают `emit(...)` после успешной записи,
 * а виджеты подписываются через `subscribe(...)` в useEffect.
 */

export const ATTACKS_CHANGED = 'calm:attacks-changed'
export const MEDICATIONS_CHANGED = 'calm:medications-changed'
export const ZONES_CHANGED = 'calm:zones-changed'

export const emit = name => {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new CustomEvent(name))
}

export const subscribe = (name, handler) => {
	if (typeof window === 'undefined') return () => {}
	window.addEventListener(name, handler)
	return () => window.removeEventListener(name, handler)
}
