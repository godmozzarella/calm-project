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

export const authApi = {
  login:    (email, password)       => http.post('/auth/login',    { email, password }).then(saveSession),
  register: (email, password, name) => http.post('/auth/register', { email, password, name }).then(saveSession),
  verifyEmail: code => http.post('/auth/verify-email', { code }),
  sendVerificationCode: () => http.post('/auth/send-verification-code', {}),
  logout: async () => {
    try { await http.post('/auth/logout', {}) } catch { /* Удаляем локальную сессию и без связи с сервером. */ }
    clearToken()
    clearRefreshToken()
    clearSessionActivity()
    localStorage.removeItem('calm_current_user')
    emit(AUTH_CHANGED)
  },
}
