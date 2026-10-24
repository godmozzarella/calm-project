import test from 'node:test'
import assert from 'node:assert/strict'
import { sortAttacksNewest } from './sortAttacks.js'
import { getAttackTypeLabel } from './constants.js'

test('ongoing attack leads, then later starts, without changing source order', () => {
	const attacks = [
		{ id: 'morning', startDate: '2026-10-15', startTime: '08:00', ongoing: false },
		{ id: 'ongoing', startDate: '2026-10-15', startTime: '09:00', ongoing: true },
		{ id: 'evening', startDate: '2026-10-15', startTime: '18:00', ongoing: false },
	]
	assert.deepEqual(sortAttacksNewest(attacks).map(a => a.id), ['ongoing', 'evening', 'morning'])
	assert.deepEqual(attacks.map(a => a.id), ['morning', 'ongoing', 'evening'])
})

test('backend enum codes display the pain type name', () => {
	assert.equal(getAttackTypeLabel('PULSATING'), 'Пульсирующая')
	assert.equal(getAttackTypeLabel('pulsating'), 'Пульсирующая')
})
