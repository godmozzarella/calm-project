import { http, setToken, setRefreshToken, clearToken, clearRefreshToken } from './httpClient'
import { setCurrentUser } from '@/entities/user'

const saveSession = ({ token, refreshToken, user }) => {
  setToken(token)
  setRefreshToken(refreshToken)
  setCurrentUser(user)
  return user
}

export const authApi = {
  login:    (email, password)       => http.post('/auth/login',    { email, password }).then(saveSession),
  register: (email, password, name) => http.post('/auth/register', { email, password, name }).then(saveSession),
  logout: async () => {
    try { await http.post('/auth/logout', {}) } catch {}
    clearToken()
    clearRefreshToken()
    localStorage.removeItem('calm_current_user')
  },
}
