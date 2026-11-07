import test from 'node:test'
import assert from 'node:assert/strict'
import { changeCyclePart, cycleDateParts, maxCycleDay, resolveCycleDate } from './cycleDate.mjs'

test('date picker uses current year and stores an ISO date', () => {
  assert.equal(resolveCycleDate('2', '11', '2026-11-03'), '2026-11-02')
  assert.deepEqual(cycleDateParts('2026-11-02'), { day: '2', month: '11' })
  assert.deepEqual(changeCyclePart({ cycleStart: '' }, 'day', '2', '2026-11-03'), {
    cycleStart: '2026-11-02', cycleDay: '2', cycleMonth: '11',
  })
})

test('year boundary and leap days keep the last real occurrence', () => {
  assert.equal(resolveCycleDate('30', '12', '2027-01-03'), '2026-12-30')
  assert.equal(resolveCycleDate('29', '2', '2025-03-01'), '2024-02-29')
  assert.equal(maxCycleDay('2', '2026-11-03'), 28)
  assert.equal(maxCycleDay('2', '2025-03-01'), 29)
  assert.equal(resolveCycleDate('31', '2', '2026-11-03'), '')
})

test('changing month clamps a day that does not exist there', () => {
  assert.deepEqual(changeCyclePart({ cycleStart: '2026-10-31', cycleDay: '31', cycleMonth: '10' }, 'month', '2', '2026-11-03'), {
    cycleStart: '2026-02-28', cycleDay: '28', cycleMonth: '2',
  })
})
