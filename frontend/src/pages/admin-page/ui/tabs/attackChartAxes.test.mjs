import assert from 'node:assert/strict'
import test from 'node:test'
import { countAxis, dateTicks, spacedDateLabels } from './attackChartAxes.mjs'

test('date ticks use calendar boundaries and remain visible between them', () => {
	const points = ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map(date => ({ date }))
	assert.deepEqual(dateTicks(points, 'day'), points)
	assert.deepEqual(dateTicks(points, 'week'), [points[2]])
	assert.deepEqual(dateTicks(points, 'month'), [points[1]])
	assert.deepEqual(dateTicks(points.slice(2), 'month'), [points[3]])
})

test('crowded date ticks retain readable labels without changing tick positions', () => {
	const ticks = [0, 15, 30, 45, 60].map(x => ({ x }))
	assert.deepEqual(spacedDateLabels(ticks, 29), [ticks[0], ticks[2], ticks[4]])
	assert.deepEqual(spacedDateLabels(ticks, 52), [ticks[0], ticks[4]])
	assert.equal(ticks.length, 5)
})

test('count ticks follow the selected step on both scales when there is room', () => {
	for (const scale of ['linear', 'log']) {
		assert.deepEqual(countAxis(7, 1, scale, 261).ticks(12), [0, 1, 2, 3, 4, 5, 6, 7])
		assert.deepEqual(countAxis(7, 2, scale, 261).ticks(12), [0, 2, 4, 6, 8])
		assert.deepEqual(countAxis(7, 5, scale, 261).ticks(12), [0, 5, 10])
	}
})

test('large peaks keep count labels on step multiples without overlap', () => {
	const height = 261
	const gap = 12
	for (const scale of ['linear', 'log']) {
		const { fraction, ticks } = countAxis(100_003, 5, scale, height)
		const labels = ticks(gap)
		assert.equal(labels[0], 0)
		assert.equal(labels.at(-1), 100_005)
		assert.ok(labels.every(count => count % 5 === 0))
		assert.ok(labels.slice(1).every((count, index) => (fraction(count) - fraction(labels[index])) * height >= gap - 1e-6))
	}
})
