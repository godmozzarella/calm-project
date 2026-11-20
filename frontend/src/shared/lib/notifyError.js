import { isCentralError } from './isCentralError.js'

export const notifyError = (message, title = 'Не удалось выполнить действие') => {
	window.dispatchEvent(new CustomEvent('calm:show-error', { detail: { message: message || 'Попробуйте ещё раз.', title } }))
}

export const notifyRequestError = (error, title, fallback = 'Попробуйте ещё раз.') => {
	if (isCentralError(error)) return
	const message = error?.message
	notifyError(message && !/^(?:HTTP \d+|Unauthorized|Forbidden)$/i.test(message) ? message : fallback, title)
}
