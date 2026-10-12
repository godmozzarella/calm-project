import { isSessionIdle, clearSessionActivity } from '@/shared/lib/sessionActivity'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

const TOKEN_KEY         = 'calm_token'
const REFRESH_TOKEN_KEY = 'calm_refresh_token'

export const getToken          = ()    => localStorage.getItem(TOKEN_KEY)
export const setToken          = token => localStorage.setItem(TOKEN_KEY, token)
export const clearToken        = ()    => localStorage.removeItem(TOKEN_KEY)
export const getRefreshToken   = ()    => localStorage.getItem(REFRESH_TOKEN_KEY)
export const setRefreshToken   = t     => localStorage.setItem(REFRESH_TOKEN_KEY, t)
export const clearRefreshToken = ()    => localStorage.removeItem(REFRESH_TOKEN_KEY)

const authHeaders = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() })
const isPublicAuthPath = path => ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-email'].includes(path)

// Идёт ли уже refresh? Все параллельные 401 ждут эту же promise,
// чтобы не было race condition и лишних запросов на /auth/refresh.
let refreshPromise = null

const tryRefresh = () => {
  if (isSessionIdle()) return Promise.resolve(false)
  if (refreshPromise) return refreshPromise
  const rt = getRefreshToken()
  if (!rt) return Promise.resolve(false)

  refreshPromise = (async () => {
    try {
      const res = await fetch(BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) {
        // Другая вкладка могла успеть обновить общий refresh-токен.
        return Boolean(getRefreshToken()) && getRefreshToken() !== rt && !isSessionIdle()
      }
      const body = await res.json()
      if (getRefreshToken() !== rt || isSessionIdle()) return false
      setToken(body.token)
      setRefreshToken(body.refreshToken)
      return true
    } catch {
      return false
    } finally {
      // Освобождаем флаг чуть позже, чтобы все ожидающие точно увидели true/false
      // и успели взять новый токен из localStorage перед своим retry.
      setTimeout(() => { refreshPromise = null }, 0)
    }
  })()

  return refreshPromise
}

const clearSession = () => {
  clearToken()
  clearRefreshToken()
  clearSessionActivity()
  localStorage.removeItem('calm_current_user')
  window.location.href = '/'
}

export const expireSessionIfIdle = () => {
  if (!getToken() || !isSessionIdle()) return false
  clearSession()
  return true
}

const send = (path, options) => {
  if (!isPublicAuthPath(path) && expireSessionIfIdle()) {
    return Promise.reject(new Error('Сессия истекла'))
  }
  return fetch(BASE + path, options)
}

const handle = async (res, path, retryFn) => {
  if (res.status === 204) return null
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    if (isPublicAuthPath(path)) {
      // Неверные креды — показываем сообщение в форме, не редиректим
      throw new Error(body.message ?? 'Unauthorized')
    }
    // Протух access-токен — пробуем обновить через refresh
    const refreshed = await tryRefresh()
    if (refreshed && retryFn) {
      return retryFn()
    }
    clearSession()
    throw new Error(body.message ?? 'Unauthorized')
  }
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10)
    const err = new Error(body.message ?? body.error ?? 'Слишком много попыток')
    err.retryAfter = retryAfter
    throw err
  }
  // `error` is usually the generic HTTP title (e.g. "Bad Request"); `message`
  // carries the useful server explanation intended for the user.
  if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`)
  return body
}

export const http = {
  get: path => {
    const go = () => send(path, { headers: authHeaders() })
      .then(r => handle(r, path, go))
    return go()
  },
  post: (path, b) => {
    const go = () => send(path, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(b) })
      .then(r => handle(r, path, go))
    return go()
  },
  put: (path, b) => {
    const go = () => send(path, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(b) })
      .then(r => handle(r, path, go))
    return go()
  },
  patch: (path, b) => {
    const go = () => send(path, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(b) })
      .then(r => handle(r, path, go))
    return go()
  },
  postForm: (path, formData) => {
    const go = () => send(path, { method: 'POST', headers: authHeaders(), body: formData })
      .then(r => handle(r, path, go))
    return go()
  },
  delete: path => {
    const go = () => send(path, { method: 'DELETE', headers: authHeaders() })
      .then(r => handle(r, path, go))
    return go()
  },
}
