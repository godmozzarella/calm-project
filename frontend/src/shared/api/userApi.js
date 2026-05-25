import { http } from './httpClient'

export const userApi = {
  getMe:         ()       => http.get('/users/me'),
  updateMe:      (patch)  => http.patch('/users/me', patch),
  deleteAccount: ()       => http.delete('/users/me'),
}
