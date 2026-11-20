import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./httpClient.js', import.meta.url), 'utf8')
    .replace(/^import .*sessionActivity'.*$/m, 'const isSessionIdle = () => false; const clearSessionActivity = () => {}; const sessionStorage = { setItem() {} }')
    .replace(/^import .*entities\/user'.*$/m, "const getCurrentUser = () => JSON.parse(localStorage.getItem('calm_current_user')); const setCurrentUser = user => localStorage.setItem('calm_current_user', JSON.stringify(user))")
    .replace(/^import .*dataEvents'.*$/m, "const emit = name => window.dispatchEvent(new Event(name)); const AUTH_CHANGED = 'calm:auth-changed'")

test('server failures emit one global error while field validation stays with the form', async () => {
    const previous = { fetch: globalThis.fetch, window: globalThis.window, storage: globalThis.localStorage, customEvent: globalThis.CustomEvent }
    try {
        const events = []
        globalThis.localStorage = { getItem: () => null }
        globalThis.window = { dispatchEvent: event => events.push(event) }
        globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail } }
        globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Сервис временно недоступен' }), { status: 503 })
        const code = source.replace('import.meta.env.VITE_API_URL', 'undefined') + '\n// server-notice test'
        const { http } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
        await assert.rejects(http.get('/forecast'), error => error.status === 503)
        assert.equal(events.filter(event => event.type === 'calm:show-error').length, 1)
        assert.equal(events.find(event => event.type === 'calm:show-error').detail.message, 'Сервис временно недоступен')
        globalThis.fetch = async () => new Response(JSON.stringify({
            message: 'Ошибка валидации', details: ['startTime: укажите время начала'],
        }), { status: 400 })
        await assert.rejects(http.post('/attacks', {}), error =>
            error.status === 400 && error.fieldValidation?.[0] === 'startTime: укажите время начала')
        assert.equal(events.filter(event => event.type === 'calm:show-error').length, 1)
    } finally {
        globalThis.fetch = previous.fetch
        globalThis.window = previous.window
        globalThis.localStorage = previous.storage
        globalThis.CustomEvent = previous.customEvent
    }
})

test('a protected request refreshes at most once when the retry is also unauthorized', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = globalThis.window
    const originalStorage = globalThis.localStorage
    try {
        const jwt = version => `header.${Buffer.from(JSON.stringify({ sessionId: 'same-session', version })).toString('base64url')}.signature`
        const storage = new Map([['calm_token', jwt('old')], ['calm_refresh_token', 'refresh']])
        globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
        globalThis.window = { dispatchEvent() {}, location: { href: '/profile' } }
        const requests = []
        globalThis.fetch = async url => {
            requests.push(url)
            return url.endsWith('/auth/refresh')
                ? new Response(JSON.stringify({ token: jwt('new'), refreshToken: 'rotated' }), { status: 200 })
                : new Response('{}', { status: 401 })
        }
        const { http } = await import(`data:text/javascript;base64,${Buffer.from(source.replace('import.meta.env.VITE_API_URL', 'undefined')).toString('base64')}`)
        await assert.rejects(http.get('/risk/participation'))
        assert.equal(requests.length, 3)
        assert.equal(window.location.href, '/#regAndLog')
        assert.equal(storage.has('calm_token'), false)
    } finally {
        globalThis.fetch = originalFetch
        globalThis.window = originalWindow
        globalThis.localStorage = originalStorage
    }
})

test('a late response from a signed-out account cannot clear the new account session', async () => {
    const originalFetch = globalThis.fetch
    const originalWindow = globalThis.window
    const originalStorage = globalThis.localStorage
    try {
        const jwt = id => `header.${Buffer.from(JSON.stringify({ sessionId: id })).toString('base64url')}.signature`
        const storage = new Map([['calm_token', jwt('old-account')], ['calm_refresh_token', 'old-refresh']])
        globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
        globalThis.window = { dispatchEvent() {}, location: { href: '/profile' } }
        let respond
        globalThis.fetch = () => new Promise(resolve => { respond = resolve })
        const code = source.replace('import.meta.env.VITE_API_URL', 'undefined') + '\n// isolated stale-response test'
        const { http } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
        const request = http.get('/users/me')
        storage.set('calm_token', jwt('new-account'))
        storage.set('calm_refresh_token', 'new-refresh')
        respond(new Response('{}', { status: 401 }))
        await assert.rejects(request, /Сессия запроса изменена/)
        assert.equal(storage.get('calm_token'), jwt('new-account'))
        assert.equal(window.location.href, '/profile')
    } finally {
        globalThis.fetch = originalFetch
        globalThis.window = originalWindow
        globalThis.localStorage = originalStorage
    }
})

test('public email verification does not refresh or clear another login session', async () => {
    const previous = { fetch: globalThis.fetch, window: globalThis.window, storage: globalThis.localStorage }
    try {
        const storage = new Map([['calm_token', 'existing-login'], ['calm_refresh_token', 'existing-refresh']])
        globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
        globalThis.window = { dispatchEvent() {}, location: { href: '/' } }
        const requests = []
        globalThis.fetch = async url => {
            requests.push(url)
            return new Response(JSON.stringify({ message: 'Неверный код' }), { status: 401 })
        }
        const code = source.replace('import.meta.env.VITE_API_URL', 'undefined') + '\n// public verification test'
        const { http } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
        await assert.rejects(http.post('/auth/email/verify', { email: 'test@example.test', code: '0000' }), /Неверный код/)
        assert.equal(requests.length, 1)
        assert.equal(storage.get('calm_token'), 'existing-login')
        assert.equal(window.location.href, '/')
    } finally {
        globalThis.fetch = previous.fetch
        globalThis.window = previous.window
        globalThis.localStorage = previous.storage
    }
})

test('restores a session from the cookie when the app starts without cached user data', async () => {
    const previous = { fetch: globalThis.fetch, window: globalThis.window, storage: globalThis.localStorage }
    try {
        const storage = new Map()
        globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
        const events = []
        globalThis.window = { dispatchEvent: event => events.push(event.type) }
        const user = { id: 'calm-user', email: 'test@example.test' }
        globalThis.fetch = async (url, options) => {
            assert.ok(url.endsWith('/auth/refresh'))
            assert.equal(options.credentials, 'include')
            assert.equal(JSON.parse(options.body).refreshToken, null)
            return new Response(JSON.stringify({ token: 'renewed-token', user }))
        }
        const code = source.replace('import.meta.env.VITE_API_URL', 'undefined') + '\n// cookie recovery'
        const { restoreSession } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
        assert.equal(await restoreSession(), true)
        assert.equal(storage.get('calm_token'), 'renewed-token')
        assert.deepEqual(JSON.parse(storage.get('calm_current_user')), user)
        assert.ok(events.includes('calm:auth-changed'))
    } finally {
        globalThis.fetch = previous.fetch
        globalThis.window = previous.window
        globalThis.localStorage = previous.storage
    }
})
