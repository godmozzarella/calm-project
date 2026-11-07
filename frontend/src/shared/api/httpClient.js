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

// Access tokens rotate, but a login session keeps the same sessionId.
const sessionIdentity = token => {
  if (!token) return null
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sessionId ?? token }
  catch { return token }
}
const assertSameSession = identity => {
  if (identity !== sessionIdentity(getToken())) throw new Error('Сессия запроса изменена')
}

const authHeaders = () => {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() })
const isPublicAuthPath = path => ['/auth/login', '/auth/register', '/auth/verify-registration', '/auth/resend-registration-code', '/auth/cancel-registration', '/auth/cancel-email-change', '/auth/password-reset/request', '/auth/password-reset/verify', '/auth/password-reset/confirm', '/auth/refresh'].includes(path)
const networkMessage = () => navigator.onLine
  ? 'Не удалось связаться с сервером. Повторите попытку через минуту.'
  : 'Нет подключения к интернету. Проверьте соединение и повторите попытку.'
const reportNetworkError = () => window.dispatchEvent(new Event('calm:network-error'))
const reportNetworkRestored = () => window.dispatchEvent(new Event('calm:network-restored'))

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
      reportNetworkRestored()
      if (!res.ok) {
		if (res.status >= 500) { reportNetworkError(); return null }
        // Другая вкладка могла успеть обновить общий refresh-токен.
        return Boolean(getRefreshToken()) && getRefreshToken() !== rt && !isSessionIdle()
      }
      const body = await res.json()
      if (getRefreshToken() !== rt || isSessionIdle()) return false
      setToken(body.token)
      setRefreshToken(body.refreshToken)
      return true
    } catch {
      reportNetworkError()
      return null
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
    .then(res => { reportNetworkRestored(); return res })
    .catch(error => {
      if (error instanceof TypeError) {
        reportNetworkError()
        const networkError = new Error(networkMessage())
        networkError.networkFailure = true
        throw networkError
      }
      throw error
    })
}

const handle = async (res, path, retryFn, requestSession) => {
  if (!isPublicAuthPath(path)) assertSameSession(requestSession)
  if (res.status === 204) return null
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    if (isPublicAuthPath(path)) {
      // Неверные креды — показываем сообщение в форме, не редиректим
      throw new Error(body.message ?? 'Unauthorized')
    }
    if (!retryFn) {
      clearSession()
      throw new Error(body.message ?? 'Сессия завершена. Войдите снова.')
    }
    // Only one refresh/retry per request.
    const refreshed = await tryRefresh()
    assertSameSession(requestSession)
    if (refreshed && retryFn) {
      return retryFn()
    }
    if (refreshed === null) {
      const networkError = new Error(networkMessage())
      networkError.networkFailure = true
      throw networkError
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
	if (res.status === 413) throw new Error('Файл слишком большой. Максимальный размер — 5 МБ.')
  // `error` is usually the generic HTTP title (e.g. "Bad Request"); `message`
  // carries the useful server explanation intended for the user.
  if (!res.ok) {
    const error = new Error(body.message ?? body.error ?? `HTTP ${res.status}`)
    error.status = res.status
    if (res.status >= 500) {
      window.dispatchEvent(new CustomEvent('calm:show-error', {
        detail: { title: 'Ошибка сервера', message: error.message },
      }))
    }
    throw error
  }
  return body
}

export const http = {
  get: path => {
    const requestSession = sessionIdentity(getToken())
    const go = (retried = false) => send(path, { headers: authHeaders() })
      .then(r => handle(r, path, retried ? null : () => go(true), requestSession))
    return go()
  },
  post: (path, b) => {
    const requestSession = sessionIdentity(getToken())
    const go = (retried = false) => send(path, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(b) })
      .then(r => handle(r, path, retried ? null : () => go(true), requestSession))
    return go()
  },
  put: (path, b) => {
    const requestSession = sessionIdentity(getToken())
    const go = (retried = false) => send(path, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(b) })
      .then(r => handle(r, path, retried ? null : () => go(true), requestSession))
    return go()
  },
  patch: (path, b) => {
    const requestSession = sessionIdentity(getToken())
    const go = (retried = false) => send(path, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(b) })
      .then(r => handle(r, path, retried ? null : () => go(true), requestSession))
    return go()
  },
  postForm: (path, formData) => {
    const requestSession = sessionIdentity(getToken())
    const go = (retried = false) => send(path, { method: 'POST', headers: authHeaders(), body: formData })
      .then(r => handle(r, path, retried ? null : () => go(true), requestSession))
    return go()
  },
  delete: (path, body) => {
    const requestSession = sessionIdentity(getToken())
    const go = (retried = false) => send(path, {
      method: 'DELETE',
      headers: body ? jsonHeaders() : authHeaders(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
      .then(r => handle(r, path, retried ? null : () => go(true), requestSession))
    return go()
  },
}
