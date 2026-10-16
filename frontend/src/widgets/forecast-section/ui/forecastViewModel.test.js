import assert from 'node:assert/strict'
import test from 'node:test'
import { advice, helpfulMedication, riskFactors, weatherTiles } from './forecastViewModel.js'

const inputs = {
  weatherScore: 65, pressureDelta24hMmHg: -3.8, humidity: 78,
  tempMin: 3, tempMax: 15, kpIndex: 5.1,
  attacksLast3Days: 2, attacksLast7Days: 3,
}
const risk = {
  dataAvailable: true, level: 'HIGH', historyLevel: 'MEDIUM', inputs,
  reasons: ['Погодный риск: 65 из 100', 'Приступ был вчера', 'Несколько приступов за последние 3 дня', 'Частые приступы за последнюю неделю'],
  personalFactors: [],
}

test('factors use the scoring rules and keep Kp separate from weather', () => {
  const factors = riskFactors(risk)
  assert.deepEqual(factors.map(f => [f.key, f.points]), [
    ['weather', 50], ['history', 34], ['magnetic', 15],
  ])
  assert.equal(weatherTiles(inputs).find(t => t.key === 'kp').alert, true)
})

test('forecast pressure and its change are displayed in mmHg', () => {
  const values = { ...inputs, pressureMmHg: 750 }
  const pressure = weatherTiles(values).find(tile => tile.key === 'pressure')
  assert.equal(pressure.value, '750 мм рт. ст.')
  assert.match(pressure.status, /-3,8 мм рт\. ст\. за сутки/)
  assert.match(riskFactors({ ...risk, inputs: values }).find(factor => factor.key === 'weather').detail, /-3,8 мм рт\. ст\./)
})

test('low-history state hides personal contribution and medication tip uses a helped entry', () => {
  assert.equal(riskFactors({ ...risk, historyLevel: 'LOW' }).some(f => f.key === 'history'), false)
  const medication = helpfulMedication([{ name: 'А', effectiveness: 1 }, { name: 'Б', effectiveness: 3 }])
  assert.equal(medication, 'Б')
  assert.match(advice(risk, medication)[0], /Б/)
})
