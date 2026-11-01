import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldSuggestLocation } from './locationPolicy.js'
const a = { latitude: 55.75, longitude: 37.62, city: 'Москва, Россия', locationMode: 'AUTO' }
test('manual selection never suggests an automatic change', () => {
    assert.equal(shouldSuggestLocation({ ...a, locationMode: 'MANUAL' }, { latitude: 60, longitude: 30, city: 'Б' }), false)
})
test('automatic selection suggests a new city and ignores small GPS jitter in the same city', () => {
    assert.equal(shouldSuggestLocation(a, { latitude: 55.751, longitude: 37.621, city: 'Москва' }), false)
    assert.equal(shouldSuggestLocation(a, { latitude: 60, longitude: 30, city: 'Санкт-Петербург' }), true)
})
