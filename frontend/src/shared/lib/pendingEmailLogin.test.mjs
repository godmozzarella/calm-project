import assert from 'node:assert/strict'
import test from 'node:test'
import { clearPendingEmailLogin, readPendingEmailLogin, savePendingEmailLogin } from './pendingEmailLogin.js'
import { isSessionIdle } from './sessionActivity.js'

test('restores only the email and timers after a reload and discards expired requests', () => {
	const previous = globalThis.localStorage
	const storage = new Map()
	globalThis.localStorage = {
		getItem: key => storage.get(key) ?? null,
		setItem: (key, value) => storage.set(key, value),
		removeItem: key => storage.delete(key),
	}
	try {
		const request = { address: 'test@example.test', retryAt: 61_000, expiresAt: 601_000 }
		savePendingEmailLogin({ ...request, code: '0123' })
		assert.deepEqual(readPendingEmailLogin(70_000), request)
		assert.equal(readPendingEmailLogin(request.expiresAt), null)
		assert.equal(storage.size, 0)
		savePendingEmailLogin(request)
		clearPendingEmailLogin()
		assert.equal(readPendingEmailLogin(70_000), null)
	} finally {
		globalThis.localStorage = previous
	}
})

test('a missing activity timestamp defers to the server and an actual month of inactivity expires locally', () => {
	const previous = globalThis.localStorage
	let value = null
	globalThis.localStorage = { getItem: () => value }
	try {
		const now = Date.UTC(2026, 10, 19)
		const month = 30 * 24 * 60 * 60 * 1000
		assert.equal(isSessionIdle(now), false)
		value = String(now - month + 1)
		assert.equal(isSessionIdle(now), false)
		value = String(now - month)
		assert.equal(isSessionIdle(now), true)
	} finally {
		globalThis.localStorage = previous
	}
})
