const LAST_ACTIVITY_KEY = 'calm_last_activity'
const IDLE_LIMIT_MS = 30 * 24 * 60 * 60 * 1000

export const touchSession = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
export const clearSessionActivity = () => localStorage.removeItem(LAST_ACTIVITY_KEY)

export const isSessionIdle = (now = Date.now()) => {
	const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
	return Number.isFinite(lastActivity) && lastActivity > 0 && now - lastActivity >= IDLE_LIMIT_MS
}
