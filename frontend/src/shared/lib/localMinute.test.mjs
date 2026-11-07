import test from 'node:test'
import assert from 'node:assert/strict'
import { isFutureLocalMinute, localMinute } from './localMinute.js'

test('a medication intake may be recorded at the current minute, but not later', () => {
  const current = { date: '2026-11-07', time: '14:06' }
  assert.equal(isFutureLocalMinute('2026-11-07', '14:06', current), false)
  assert.equal(isFutureLocalMinute('2026-11-07', '14:07', current), true)
  assert.equal(isFutureLocalMinute('2026-11-07', '9:05', current), false)
  assert.equal(isFutureLocalMinute('2026-11-07', '23:00', current), true)
  assert.equal(isFutureLocalMinute('2026-11-06', '23:59', current), false)
  assert.equal(isFutureLocalMinute('2026-11-08', '00:00', current), true)
})

test('localMinute formats the browser local date and minute', () => {
  const instant = new Date(2026, 10, 7, 4, 5, 59)
  assert.deepEqual(localMinute(instant), { date: '2026-11-07', time: '04:05' })
})
