import { http } from './httpClient'

export const userApi = {
  getMe:         ()       => http.get('/users/me'),
  updateMe:      (patch)  => http.patch('/users/me', patch),
  getEmailChangeStatus: () => http.get('/users/me/email-change'),
  startEmailChange: newEmail => http.post('/users/me/email-change', { newEmail }),
  resendEmailChangeCode: () => http.post('/users/me/email-change/resend', {}),
  confirmEmailChange: code => http.post('/users/me/email-change/confirm', { code }),
  cancelEmailChange: () => http.delete('/users/me/email-change'),
  deleteAccount: ()       => http.delete('/users/me'),
}
