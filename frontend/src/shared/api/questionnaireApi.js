import { http } from './httpClient'
export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
export const questionnaireApi = {
  status: () => http.get(`/questionnaire?timezone=${encodeURIComponent(browserTimezone())}`),
  getProfile: () => http.get('/questionnaire/profile').then(profile => profile?.sex ? profile : null),
  profile: data => http.put('/questionnaire/profile', data),
  submit: (date, timezone, answers) => http.post('/questionnaire', { date, timezone, answers }),
  cycleMarks: () => http.get('/questionnaire/cycle'),
  putCycleMark: (date, kind) => http.put(`/questionnaire/cycle/${date}/${kind}?timezone=${encodeURIComponent(browserTimezone())}`, {}),
  deleteCycleMark: (date, kind) => http.delete(`/questionnaire/cycle/${date}/${kind}?timezone=${encodeURIComponent(browserTimezone())}`),
}
