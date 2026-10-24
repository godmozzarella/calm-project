export const notifyError = (message, title = 'Не удалось выполнить действие') => {
	window.dispatchEvent(new CustomEvent('calm:show-error', { detail: { message: message || 'Попробуйте ещё раз.', title } }))
}
