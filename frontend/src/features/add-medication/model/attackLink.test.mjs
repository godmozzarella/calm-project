import test from 'node:test'
import assert from 'node:assert/strict'
import { attacksForDate, defaultAttackId, formatAttackOption } from './attackLink.mjs'

test('only attacks present on the selected day are available; an ongoing one takes priority', () => {
	const earlier = { id: 'earlier', startDate: '2026-11-03', startTime: '12:00:00', ongoing: false }
	const later = { id: 'later', startDate: '2026-11-04', startTime: '09:00:00', ongoing: false }
	const ongoing = { id: 'ongoing', startDate: '2026-11-01', startTime: '07:00:00', ongoing: true }
	const spanning = { id: 'spanning', startDate: '2026-11-02', startTime: '22:00:00', endDate: '2026-11-03', endTime: '08:00:00', ongoing: false }
	assert.equal(defaultAttackId([], '2026-11-04'), null)
	assert.deepEqual(attacksForDate([earlier, later, spanning], '2026-11-03').map(a => a.id), ['earlier', 'spanning'])
	assert.deepEqual(attacksForDate([earlier, later, spanning], '2026-11-04').map(a => a.id), ['later'])
	assert.equal(defaultAttackId([earlier, later], '2026-11-04'), 'later')
	assert.equal(defaultAttackId([later, ongoing, earlier], '2026-11-04'), 'ongoing')
})

test('attack option shows date, time, end state and plain pain level', () => {
	const attack = { startDate: '2026-11-03', startTime: '12:00:00', ongoing: true, intensity: 3 }
	assert.equal(formatAttackOption(attack), '3 ноя. 12:00 - продолжается, 3')
	assert.equal(formatAttackOption({ ...attack, ongoing: false, endDate: '2026-11-03', endTime: '14:30:00' }), '3 ноя. 12:00 - 14:30, 3')
	assert.equal(formatAttackOption({ ...attack, ongoing: false, endDate: '2026-11-04', endTime: '08:00:00' }), '3 ноя. 12:00 - 4 ноя. 08:00, 3')
})
