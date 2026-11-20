import { isValidEmail } from './validation/email.js'

const KEY = 'calm_pending_email_login'

export const readPendingEmailLogin = (now = Date.now()) => {
	try {
		const pending = JSON.parse(localStorage.getItem(KEY))
		if (!pending) return null
		const { address, retryAt, expiresAt } = pending
		if (typeof address === 'string' && address.length <= 254 && isValidEmail(address)
			&& Number.isFinite(retryAt) && Number.isFinite(expiresAt) && expiresAt > now) {
			return { address, retryAt, expiresAt }
		}
		localStorage.removeItem(KEY)
	} catch { /* Login still works while browser storage is unavailable. */ }
	return null
}

export const savePendingEmailLogin = ({ address, retryAt, expiresAt }) => {
	try { localStorage.setItem(KEY, JSON.stringify({ address, retryAt, expiresAt })) }
	catch { /* The open form still retains the request. */ }
}

export const clearPendingEmailLogin = () => {
	try { localStorage.removeItem(KEY) }
	catch { /* Storage may be unavailable. */ }
}
