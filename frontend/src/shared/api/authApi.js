import { http, setToken, setRefreshToken, clearToken, clearRefreshToken } from './httpClient'
import { setCurrentUser } from '@/entities/user'
import { touchSession, clearSessionActivity } from '@/shared/lib/sessionActivity'
import { emit, AUTH_CHANGED } from '@/shared/lib/dataEvents'

const saveSession = ({ token, refreshToken, user }) => {
  setToken(token)
  setRefreshToken(refreshToken)
  setCurrentUser(user)
  touchSession()
  emit(AUTH_CHANGED)
  return user
}

const clearLocalSession = () => {
	clearToken()
	clearRefreshToken()
	clearSessionActivity()
	localStorage.removeItem('calm_current_user')
	emit(AUTH_CHANGED)
}

export const authApi = {
  login:    (email, password)       => http.post('/auth/login',    { email, password }).then(saveSession),
  register: (email, password, name) => http.post('/auth/register', { email, password, name }),
  verifyRegistration: (email, password, code) => http.post('/auth/verify-registration', { email, password, code }).then(saveSession),
  resendRegistrationCode: (email, password) => http.post('/auth/resend-registration-code', { email, password }),
  cancelRegistration: (email, password) => http.post('/auth/cancel-registration', { email, password }),
  cancelEmailChangeByToken: token => http.post('/auth/cancel-email-change', { token }),
  requestPasswordReset: email => http.post('/auth/password-reset/request', { email }),
  verifyPasswordReset: (email, code) => http.post('/auth/password-reset/verify', { email, code }),
  confirmPasswordReset: (email, verificationToken, newPassword) => http.post('/auth/password-reset/confirm', { email, verificationToken, newPassword }),
  clearLocalSession,
  verifyEmail: code => http.post('/auth/verify-email', { code }),
  sendVerificationCode: () => http.post('/auth/send-verification-code', {}),
  logout: async () => {
    try { await http.post('/auth/logout', {}) } catch { /* Удаляем локальную сессию и без связи с сервером. */ }
    clearLocalSession()
  },
}
