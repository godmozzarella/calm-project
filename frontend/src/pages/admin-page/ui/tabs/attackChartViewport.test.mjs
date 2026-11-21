import assert from 'node:assert/strict'
import test from 'node:test'
import { maxVisibleDaySpan, panViewport, readableViewport, visibleDayBounds, zoomViewport } from './attackChartViewport.mjs'

test('date steps show the latest three, six or twelve months and allow panning to earlier dates', () => {
	const lastDate = '2026-11-21'
	const lastIndex = 500
	assert.deepEqual(['day', 'week', 'month'].map(step => maxVisibleDaySpan(lastDate, lastIndex, step)), [92, 184, 365])
	const weeklyView = readableViewport(null, lastIndex, maxVisibleDaySpan(lastDate, lastIndex, 'week'))
	assert.deepEqual(visibleDayBounds(weeklyView, lastIndex), [316, 500])
	assert.deepEqual(visibleDayBounds(panViewport(weeklyView, lastIndex, -1), lastIndex), [132, 316])
})

test('window limits handle the ends of months and dates with little history', () => {
	assert.equal(maxVisibleDaySpan('2024-05-31', 500, 'day'), 92)
	assert.equal(maxVisibleDaySpan('2024-02-29', 500, 'month'), 366)
	assert.equal(maxVisibleDaySpan('2026-11-21', 6, 'month'), 6)
	assert.equal(maxVisibleDaySpan('2026-11-21', 0, 'day'), 0)
})

test('zoom keeps the pointed date anchored and a moving pinch also pans the chart', () => {
	const view = zoomViewport(null, 32, 2, 0.25)
	assert.deepEqual(view, { start: 4, span: 16 })
	assert.deepEqual(zoomViewport(view, 32, 2, 0.25, 0.5), { start: 4, span: 8 })
})

test('long periods pan at normal scale and after zooming without passing their end dates', () => {
	const normal = readableViewport(null, 99, 8)
	assert.deepEqual(visibleDayBounds(normal, 99), [91, 99])
	assert.deepEqual(visibleDayBounds(panViewport(normal, 99, -1), 99), [83, 91])
	const zoomed = zoomViewport(normal, 99, 2, 0.5, 0.5, 8)
	assert.deepEqual(visibleDayBounds(panViewport(zoomed, 99, 100), 99), [95, 99])
	assert.deepEqual(visibleDayBounds(panViewport(zoomed, 99, -100), 99), [0, 4])
	assert.equal(zoomViewport(zoomed, 99, 0.01, 0.5, 0.5, 8).span, 8)
})

test('viewport bounds preserve at least two days and reset to the entire range', () => {
	const view = zoomViewport(null, 30, 100, 1)
	assert.deepEqual(visibleDayBounds(view, 30), [29, 30])
	assert.deepEqual(visibleDayBounds(zoomViewport(view, 30, 0.01), 30), [0, 30])
	assert.deepEqual(visibleDayBounds(zoomViewport(null, 0, 2), 0), [0, 0])
})
