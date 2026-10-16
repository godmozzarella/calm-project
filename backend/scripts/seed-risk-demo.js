// Запускать через mongosh в исходной локальной БД. Меняет только calm_risk_demo.
const source = db
const demoName = 'calm_risk_demo'
if (source.getName() === demoName) throw new Error('Подключитесь к исходной БД, а не к calm_risk_demo')

const email = process.env.CALM_RISK_DEMO_EMAIL
const admins = source.users.find(email ? { email, role: 'ADMIN' } : { role: 'ADMIN' }).limit(2).toArray()
if (admins.length !== 1) throw new Error('Нужен один администратор: укажите CALM_RISK_DEMO_EMAIL')
const admin = admins[0]
if (admin.latitude == null || admin.longitude == null) {
  throw new Error('У администратора должна быть указана локация')
}

const demo = source.getSiblingDB(demoName)
const existingUsers = demo.users.find({}).toArray()
if (existingUsers.some(user => String(user._id) !== String(admin._id))) {
  throw new Error('В calm_risk_demo уже есть другая учётная запись; данные не изменены')
}

const todayText = process.env.CALM_RISK_DEMO_TODAY ||
  new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(todayText)) throw new Error('Неверный CALM_RISK_DEMO_TODAY')
const today = new Date(todayText + 'T00:00:00.000Z')
if (Number.isNaN(today.getTime())) throw new Error('Неверный CALM_RISK_DEMO_TODAY')
const userId = String(admin._id)
const demoUser = { ...admin, refreshToken: null, refreshTokenExpiry: null,
  lastNotifiedDate: null, notificationsEnabled: false }
demo.users.replaceOne({ _id: admin._id }, demoUser, { upsert: true })
demo.attacks.deleteMany({ _id: /^risk-demo-attack-/ })
demo.medications.deleteMany({ _id: /^risk-demo-medication-/ })
demo.forecast_snapshots.deleteMany({ _id: /^risk-demo-weather-/ })

const dayAgo = offset => new Date(today.getTime() - offset * 24 * 60 * 60 * 1000)
const attackOffsets = new Set([1, 2, 5, 9, 15, 22, 29, 36, 43, 50, 57])
const medicationOffsets = [1, 2, 5, 9]
const locationKey = `${Number(admin.latitude).toFixed(2)},${Number(admin.longitude).toFixed(2)}`

for (let offset = -3; offset <= 60; offset++) {
  const attackDay = attackOffsets.has(offset)
	const forecastScore = offset < 0 ? [18, 45, 70][Math.abs(offset) - 1] : 18
  const date = dayAgo(offset)
  const suffix = date.toISOString().slice(0, 10)
  demo.forecast_snapshots.replaceOne(
    { _id: `risk-demo-weather-${suffix}` },
    {
      _id: `risk-demo-weather-${suffix}`,
      locationKey,
      date,
      risk: attackDay || forecastScore >= 55 ? 'HIGH' : forecastScore >= 30 ? 'MEDIUM' : 'LOW',
      score: attackDay ? 65 : offset <= 0 ? forecastScore : 12,
      pressureMmHg: attackDay ? 746.3 : 757.6,
      pressureDelta24hMmHg: attackDay ? -6.0 : -0.8,
      humidity: attackDay ? 88 : 62,
      tempMin: 10,
      tempMax: attackDay ? 22 : 17,
      windKmhMax: 12,
      kpIndex: attackDay ? 5 : 2,
    },
    { upsert: true },
  )

  if (attackDay) {
    demo.attacks.replaceOne(
      { _id: `risk-demo-attack-${suffix}` },
      {
        _id: `risk-demo-attack-${suffix}`,
        userId,
        startDate: date,
        startTime: new Date(date.getTime() + 10 * 60 * 60 * 1000),
        endDate: date,
        endTime: new Date(date.getTime() + 12 * 60 * 60 * 1000),
        ongoing: false,
        intensity: 6,
        type: 'PULSATING',
        symptoms: [],
        triggers: [],
        painZones: {},
        note: 'Синтетические данные для проверки персонального риска',
      },
      { upsert: true },
    )
  }
}

for (const offset of medicationOffsets) {
  const date = dayAgo(offset)
  const suffix = date.toISOString().slice(0, 10)
  demo.medications.replaceOne(
    { _id: `risk-demo-medication-${suffix}` },
    {
      _id: `risk-demo-medication-${suffix}`,
      userId,
      name: 'Тестовый препарат',
      dosage: '1',
      date,
      time: new Date(date.getTime() + 11 * 60 * 60 * 1000),
      therapeuticClass: 'nsaid',
      purpose: 'acute',
      note: 'Синтетические данные для проверки персонального риска',
    },
    { upsert: true },
  )
}

print(`Готово: ${demoName}, 60 дней истории и 4 дня прогноза, ${attackOffsets.size} дней приступов, ${medicationOffsets.length} дней препаратов.`)
