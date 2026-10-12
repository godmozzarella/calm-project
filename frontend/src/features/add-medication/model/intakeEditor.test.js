import test from 'node:test'
import assert from 'node:assert/strict'
import { intakeMembers, planIntakeUpdate } from './intakeEditor.js'

const med = (id, overrides = {}) => ({
	id,
	name: id,
	date: '2026-10-11',
	time: '12:00:00',
	attackId: null,
	note: '',
	createdAt: '2026-10-11T09:00:00Z',
	...overrides,
})

test('new intake groups only records with the same intakeId', () => {
	const first = med('a', { intakeId: 'intake-1' })
	const second = med('b', { intakeId: 'intake-1' })
	const other = med('c', { intakeId: 'intake-2' })
	assert.deepEqual(intakeMembers(first, [first, second, other]), [first, second])
})

test('legacy intake includes only nearby records with matching details', () => {
	const first = med('a')
	const second = med('b', { createdAt: '2026-10-11T09:00:02Z' })
	const later = med('c', { createdAt: '2026-10-11T09:01:00Z' })
	const otherTime = med('d', { time: '12:01:00' })
	assert.deepEqual(intakeMembers(first, [first, second, later, otherTime]), [first, second])
})

test('rewriting several medicines preserves surviving ids and removes only excluded rows', () => {
	const existing = [med('a', { name: 'A' }), med('b', { name: 'B' })]
	const selected = [
		{ name: 'C', category: 'Таблетки', clientId: 'new' },
		{ sourceId: 'b', name: 'B', category: 'Другое' },
	]
	const plan = planIntakeUpdate(existing, selected)
	assert.deepEqual(plan.updates.map(u => [u.original.id, u.item.name]), [['a', 'C'], ['b', 'B']])
	assert.deepEqual(plan.creates, [])
	assert.deepEqual(plan.removes, [])
})

test('rewriting one medicine as three creates exactly two new rows', () => {
	const existing = [med('a', { name: 'A' })]
	const selected = [
		{ sourceId: 'a', name: 'A' },
		{ name: 'B', clientId: 'new-b' },
		{ name: 'C', clientId: 'new-c' },
	]
	const plan = planIntakeUpdate(existing, selected)
	assert.deepEqual(plan.updates.map(u => u.original.id), ['a'])
	assert.deepEqual(plan.creates.map(i => i.name), ['B', 'C'])
	assert.deepEqual(plan.removes, [])
})

test('rewriting three medicines as one removes two old rows', () => {
	const existing = [med('a'), med('b'), med('c')]
	const plan = planIntakeUpdate(existing, [{ sourceId: 'b', name: 'b' }])
	assert.deepEqual(plan.updates.map(u => u.original.id), ['b'])
	assert.deepEqual(plan.removes.map(m => m.id), ['a', 'c'])
})
