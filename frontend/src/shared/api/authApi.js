import { http, setToken, clearToken, clearRefreshToken } from './httpClient'
import { setCurrentUser } from '@/entities/user'
import { touchSession, clearSessionActivity } from '@/shared/lib/sessionActivity'
import { clearPendingEmailLogin } from '@/shared/lib/pendingEmailLogin'
import { emit, AUTH_CHANGED } from '@/shared/lib/dataEvents'

const saveSession = ({ token, user }) => {
  setToken(token)
  clearRefreshToken()
  setCurrentUser(user)
  touchSession()
  clearPendingEmailLogin()
  emit(AUTH_CHANGED)
  return user
}

const clearLocalSession = () => {
	clearToken()
	clearRefreshToken()
	clearSessionActivity()
	clearPendingEmailLogin()
	localStorage.removeItem('calm_current_user')
	emit(AUTH_CHANGED)
}

export const authApi = {
  requestEmail: email => http.post('/auth/email/request', { email }),
  verifyCode: (email, code) => http.post('/auth/email/verify', { email, code }).then(saveSession),
  verifyLink: token => http.post('/auth/email/link', { token }).then(saveSession),
  cancelEmailChangeByToken: token => http.post('/auth/cancel-email-change', { token }),
  logout: async () => {
    try { await http.post('/auth/logout', {}) } catch { /* Удаляем локальную сессию и без связи с сервером. */ }
    clearLocalSession()
  },
}
