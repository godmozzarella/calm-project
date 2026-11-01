import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const { aggregate, fetchDays } = createRequire(import.meta.url)('./historical-weather.cjs')
const root = { timezone: 'Europe/Berlin', hourly: {
    time: ['2020-01-01T00:00', '2020-01-01T12:00', '2020-01-02T00:00', '2020-01-02T12:00'],
    surface_pressure: [1000, 1000, 1010, null], relative_humidity_2m: [50, 50, 70, 70],
    temperature_2m: [null, 1, 0, 10], wind_gusts_10m: [null, 1, 0, 20],
} }
test('archive aggregation matches app units and retains real zero values', () => {
    const result = aggregate(root, '2020-01-02')
    assert.equal(result.pressureMmHg, 757.6)
    assert.equal(result.pressureDelta24hMmHg, 7.5)
    assert.equal(result.humidityDelta24h, 20)
    assert.equal(result.tempMin, 0)
    assert.equal(result.tempMax, 10)
    assert.equal(result.windKmhMax, 20)
})
test('missing archive parameters stay null instead of becoming zero', () => {
    assert.ok(Object.values(aggregate({}, '2020-01-02')).every(value => value === null))
})
test('archive request includes previous day and provenance, without manufacturing forecast scores', async () => {
    let request
    const result = await fetchDays('52.5,13.4', ['2020-01-02'], { getJson: async url => { request = url; return root } })
    assert.equal(request.searchParams.get('start_date'), '2020-01-01')
    assert.equal(request.searchParams.get('timezone'), 'auto')
    assert.equal(result['2020-01-02'].kind, 'RETROSPECTIVE_BEST_MATCH')
    assert.equal(result['2020-01-02'].features.pressureMmHg, 757.6)
    assert.equal('baselineScore' in result['2020-01-02'], false)
})
