import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync(new URL('./httpClient.js', import.meta.url), 'utf8')
    .replace(/^import .*sessionActivity'.*$/m, 'const isSessionIdle = () => false; const clearSessionActivity = () => {}')

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
        assert.equal(window.location.href, '/')
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

test('public recovery verification does not refresh or clear another login session', async () => {
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
        await assert.rejects(http.post('/auth/password-reset/verify', { email: 'test@example.test', code: '000000' }), /Неверный код/)
        assert.equal(requests.length, 1)
        assert.equal(storage.get('calm_token'), 'existing-login')
        assert.equal(window.location.href, '/')
    } finally {
        globalThis.fetch = previous.fetch
        globalThis.window = previous.window
        globalThis.localStorage = previous.storage
    }
})
