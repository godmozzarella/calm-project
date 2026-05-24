/**
 * Безопасный генератор UUID-подобных id.
 * `crypto.randomUUID` доступен только в secure context (HTTPS/localhost).
 * Если открыли dev-сервер по сетевому IP (например, с телефона) — метод
 * отсутствует, и без фолбэка вызывающий код падает с TypeError.
 */
export const generateId = () => {
	if (typeof crypto !== 'undefined') {
		if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
		if (typeof crypto.getRandomValues === 'function') {
			const bytes = new Uint8Array(16)
			crypto.getRandomValues(bytes)
			bytes[6] = (bytes[6] & 0x0f) | 0x40
			bytes[8] = (bytes[8] & 0x3f) | 0x80
			const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'))
			return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
		}
	}
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
