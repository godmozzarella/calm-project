// Archive weather is retrospective data, never a forecast claimed to exist before an event.
const https = require('node:https')
const FIELDS = ['pressureMmHg', 'pressureDelta24hMmHg', 'humidity', 'humidityDelta24h', 'tempMin', 'tempMax', 'windKmhMax']
const mean = values => {
  const valid = values.filter(value => typeof value === 'number' && Number.isFinite(value))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}
const round = value => value == null ? null : Math.round(value * 10) / 10
function aggregate(root, day) {
  const before = new Date(`${day}T00:00:00Z`); before.setUTCDate(before.getUTCDate() - 1)
  const previous = before.toISOString().slice(0, 10)
  const hourly = root.hourly || {}
  const values = (field, date) => (hourly.time || []).flatMap((time, i) => String(time).slice(0, 10) === date ? [hourly[field]?.[i]] : [])
  const pressure = mean(values('surface_pressure', day))
  const previousPressure = mean(values('surface_pressure', previous))
  const humidity = mean(values('relative_humidity_2m', day))
  const previousHumidity = mean(values('relative_humidity_2m', previous))
  const temperatures = values('temperature_2m', day).filter(v => typeof v === 'number' && Number.isFinite(v))
  const gusts = values('wind_gusts_10m', day).filter(v => typeof v === 'number' && Number.isFinite(v))
  return {
    pressureMmHg: round(pressure == null ? null : pressure * 0.750061683),
    pressureDelta24hMmHg: round(pressure == null || previousPressure == null ? null : (pressure - previousPressure) * 0.750061683),
    humidity: round(humidity), humidityDelta24h: round(humidity == null || previousHumidity == null ? null : humidity - previousHumidity),
    tempMin: temperatures.length ? Math.min(...temperatures) : null,
    tempMax: temperatures.length ? Math.max(...temperatures) : null,
    windKmhMax: gusts.length ? Math.max(...gusts) : null,
  }
}
function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`Archive HTTP ${response.statusCode}`)); return }
      let body = ''
      response.on('data', chunk => { body += chunk; if (body.length > 8_000_000) request.destroy(new Error('Archive response too large')) })
      response.on('end', () => { try { resolve(JSON.parse(body)) } catch (e) { reject(e) } })
      response.on('error', reject)
    })
    const timeout = setTimeout(() => request.destroy(new Error('Archive timeout')), 12000)
    request.on('close', () => clearTimeout(timeout))
    request.on('error', reject)
  })
}
async function fetchDays(locationGrid, dates, options = {}) {
  const [latitude, longitude] = locationGrid.split(',').map(Number)
  if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return {}
  const sorted = [...new Set(dates)].sort()
  if (!sorted.length) return {}
  const start = new Date(`${sorted[0]}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1)
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  for (const [key, value] of Object.entries({ latitude, longitude, start_date: start.toISOString().slice(0, 10),
    end_date: sorted.at(-1), hourly: 'surface_pressure,relative_humidity_2m,temperature_2m,wind_gusts_10m', timezone: 'auto', wind_speed_unit: 'kmh' })) url.searchParams.set(key, String(value))
  const root = await (options.getJson || getJson)(url)
  const result = {}
  for (const day of sorted) {
    const features = aggregate(root, day)
    if (FIELDS.some(field => features[field] != null)) result[day] = {
      cacheKey: `${locationGrid}|${day}`, locationGrid, date: day, source: 'OPEN_METEO_ARCHIVE',
      kind: 'RETROSPECTIVE_BEST_MATCH', timezone: root.timezone || null, fetchedAt: new Date(), features,
    }
  }
  return result
}
module.exports = { FIELDS, aggregate, fetchDays }
