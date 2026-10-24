import assert from 'node:assert/strict'
import test from 'node:test'
import { streakIncrease } from './streakAnimation.js'

test('streak animates only after an observed increase', () => {
	assert.equal(streakIncrease(null, 1), 0)
	assert.equal(streakIncrease({ count: 2 }, 3), 1)
	assert.equal(streakIncrease({ count: 3 }, 3), 0)
	assert.equal(streakIncrease({ count: 3 }, 0), 0)
})
