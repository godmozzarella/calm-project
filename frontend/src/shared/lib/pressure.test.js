import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPressure, formatPressureChange } from './pressure.js'

test('stored pressure in mmHg is displayed without another conversion', () => {
	assert.equal(formatPressure(750), '750 мм рт. ст.')
	assert.equal(formatPressure(null), '—')
	assert.equal(formatPressureChange(-3.8), '-3,8 мм рт. ст.')
	assert.equal(formatPressureChange(3.8), '+3,8 мм рт. ст.')
})
