import { http, setToken } from './httpClient'
import { setCurrentUser } from '@/entities/user'

const saveSession = ({ token, user }) => {
  setToken(token)
  setCurrentUser(user)
  return user
}

export const authApi = {
  login:    (email, password)        => http.post('/auth/login',    { email, password }).then(saveSession),
  register: (email, password, name)  => http.post('/auth/register', { email, password, name }).then(saveSession),
}
