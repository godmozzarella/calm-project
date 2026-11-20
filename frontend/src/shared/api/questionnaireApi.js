import { http } from './httpClient'
export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const cycleUrl = path => `/questionnaire/cycle/${path}?timezone=${encodeURIComponent(browserTimezone())}`
export const questionnaireApi = {
  status: () => http.get(`/questionnaire?timezone=${encodeURIComponent(browserTimezone())}`),
  completedDates: () => http.get('/questionnaire/completed-dates'),
  getProfile: () => http.get('/questionnaire/profile').then(profile => profile?.sex ? profile : null),
  profile: data => http.put('/questionnaire/profile', data),
  submit: (date, timezone, answers) => http.post('/questionnaire', { date, timezone, answers }),
  cycleMarks: () => http.get('/questionnaire/cycle'),
  cycleOverview: () => http.get(cycleUrl('overview')),
  putCycleRange: (start, end) => http.put(cycleUrl('range'), { start, end }),
  putCycleMark: (date, kind) => http.put(cycleUrl(`${date}/${kind}`), {}),
  deleteCycleMark: (date, kind) => http.delete(cycleUrl(`${date}/${kind}`)),
  claimCycleQuestion: () => http.post(cycleUrl('question'), {}),
  answerCycleQuestion: (question, response) => http.post(cycleUrl('answer'), { question, ...response }),
}
