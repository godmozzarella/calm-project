const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

const TOKEN_KEY = 'calm_token'

export const getToken  = ()      => localStorage.getItem(TOKEN_KEY)
export const setToken  = token   => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = ()     => localStorage.removeItem(TOKEN_KEY)

const authHeaders = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() })

const handle = async res => {
  if (res.status === 401) {
    clearToken()
    localStorage.removeItem('calm_current_user')
    window.location.href = '/'
    throw new Error('Unauthorized')
  }
  if (res.status === 204) return null
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`)
  return body
}

export const http = {
  get:    path        => fetch(BASE + path, { headers: authHeaders() }).then(handle),
  post:   (path, b)  => fetch(BASE + path, { method: 'POST',   headers: jsonHeaders(), body: JSON.stringify(b) }).then(handle),
  put:    (path, b)  => fetch(BASE + path, { method: 'PUT',    headers: jsonHeaders(), body: JSON.stringify(b) }).then(handle),
  patch:  (path, b)  => fetch(BASE + path, { method: 'PATCH',  headers: jsonHeaders(), body: JSON.stringify(b) }).then(handle),
  delete: path        => fetch(BASE + path, { method: 'DELETE', headers: authHeaders() }).then(handle),
}
