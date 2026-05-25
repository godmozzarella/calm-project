import { http } from './httpClient'

export const dictionaryApi = {
  getByType: type => http.get(`/dictionaries?type=${type}`),
}
