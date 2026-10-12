// Synthetic fixture. Hard-coded separate test DB; never reads or writes `calm`.
(() => {
  const expectedDatabase = 'calm_risk_pipeline_test_source'
  const prefix = 'pipeline-test-'
  if (db.getName() !== expectedDatabase) throw new Error(`Connect to ${expectedDatabase}`)

  const collections = [
    db.risk_model_participation,
    db.risk_prediction_records,
    db.risk_daily_outcomes,
    db.attacks,
  ]
  for (const collection of collections) {
    const unexpected = collection.find({ _id: { $not: /^pipeline-test-/ } }).limit(1).toArray()
    if (unexpected.length) throw new Error(`${expectedDatabase} contains records outside the test fixture`)
  }
  for (const collection of collections) collection.deleteMany({ _id: /^pipeline-test-/ })
  if (db.risk_model_consent_policy.countDocuments({ _id: { $ne: 'current' } }) > 0) {
    throw new Error(`${expectedDatabase} contains unexpected consent policy records`)
  }
  db.risk_model_consent_policy.deleteOne({ _id: 'current' })

  const utcToday = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const dayAgo = offset => new Date(utcToday.getTime() - offset * 86_400_000)
  const forecastRecords = []
  const outcomes = []
  const attacks = []
  const participants = []
  const crypto = require('crypto')
  const sample = (user, index, feature, min, max) => {
    const hash = crypto.createHash('sha256').update(`${user}:${index}:${feature}`).digest()
    return min + (hash.readUInt32BE(0) % (max - min + 1))
  }

  for (let user = 0; user < 31; user++) {
    const userId = `${prefix}user-${user}`
    participants.push({
      _id: `${prefix}participation-${user}`,
      userId,
      participating: user < 30,
      consentVersion: 'shared-model-pilot-v1',
      updatedAt: new Date(),
    })

    for (let index = 0; index < 10; index++) {
      const date = dayAgo(index + 2)
      const attackStarted = index < 3
      const tempMin = sample(user, index, 'temp-min', -10, 25)
      forecastRecords.push({
        _id: `${prefix}prediction-${user}-${index}`,
        userId,
        targetDate: date,
        issuedAt: new Date(date.getTime() - 16 * 3_600_000),
        timezone: 'Europe/Moscow',
        score: sample(user, index, 'score', 0, 100),
        level: 'MEDIUM',
        featureSchemaVersion: 2,
        scoringVersion: 'personal-rules-v1',
        features: {
          // Deterministic but independent of outcome: this is a pipeline fixture, not a signal model.
          weatherScore: sample(user, index, 'weather', 0, 100),
          pressureHpa: sample(user, index, 'pressure', 985, 1025),
          pressureDelta24h: sample(user, index, 'pressure-delta', -8, 8),
          humidity: sample(user, index, 'humidity', 25, 100),
          tempMin,
          tempMax: tempMin + sample(user, index, 'temp-range', 0, 15),
          windKmhMax: sample(user, index, 'wind', 0, 80),
          kpIndex: sample(user, index, 'kp', 0, 9),
          attacksLast3Days: 1,
          attacksLast7Days: 2,
          medicationDaysLast7Days: 1,
          overuseRisk: false,
          historyDays: 30,
          historyAttackDays: 5,
          attackStartsLast14Days: sample(user, index, 'attack-starts-14', 0, 3),
          attackStartsLast30Days: sample(user, index, 'attack-starts-30', 3, 7),
          meanAttackIntensityLast30Days: sample(user, index, 'mean-intensity', 1, 10),
          daysSinceLastAttackStart: sample(user, index, 'days-since-start', 1, 30),
        },
      })

      if (attackStarted) {
        attacks.push({ _id: `${prefix}attack-${user}-${index}`, userId, startDate: date })
      } else {
        outcomes.push({ _id: `${prefix}outcome-${user}-${index}`, userId, date,
          confirmedAt: new Date(date.getTime() + 86_400_000) })
      }
    }
  }

  // A later score issued after local midnight cannot replace the preliminary score.
  const firstDate = dayAgo(2)
  forecastRecords.push({
    ...forecastRecords[0],
    _id: `${prefix}late-prediction`,
    issuedAt: new Date(firstDate.getTime() - 2 * 3_600_000),
    score: 99,
  })

  db.risk_model_participation.insertMany(participants)
  db.risk_prediction_records.insertMany(forecastRecords)
  db.risk_daily_outcomes.insertMany(outcomes)
  db.attacks.insertMany(attacks)
  db.risk_model_consent_policy.insertOne({ _id: 'current', version: 'shared-model-pilot-v1',
    digest: 'a'.repeat(64), updatedAt: new Date() })
  print(`Seeded ${expectedDatabase}: ${participants.length} people, ${forecastRecords.length} scores, ${attacks.length} attack days, ${outcomes.length} confirmed quiet days`)
})()
