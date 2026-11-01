// Synthetic version-3 training source. Only for the disposable auth test database.
(() => {
  if (db.getName() !== 'calm_risk_pipeline_test_source' ||
      process.env.CALM_RISK_TRAINING_TEST_MODE !== 'YES') throw new Error('Isolated test DB only')
  const now = new Date()
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const twoDaysAgo = new Date(yesterday.getTime() - 86_400_000)
  const threeDaysAgo = new Date(twoDaysAgo.getTime() - 86_400_000)
  const captured = target => new Date(target.getTime() - 12 * 3_600_000)
  const features = {
    weatherScore: 45, pressureMmHg: 756.1, pressureDelta24hMmHg: -1.5, humidity: 60, humidityDelta24h: 5,
    tempMin: 8, tempMax: 16, windKmhMax: 15, kpIndex: 2,
    attacksLast3Days: 1, attacksLast7Days: 1, medicationDaysLast7Days: 1,
    overuseRisk: false, historyDays: 30, historyAttackDays: 4,
    attackStartsLast14Days: 1, attackStartsLast30Days: 1,
    meanAttackIntensityLast30Days: 6, daysSinceLastAttackStart: 1,
  }
  const historyDetails = {
    painTypesLast30Days: [{ code: 'PRESSING', count: 1 }],
    symptomsLast30Days: [{ code: 'nausea', count: 1 }],
    triggersLast30Days: [{ code: 'stress', count: 1 }],
    painZonesLast30Days: [{ code: 'forehead:red', count: 1 }],
    medicationNamesLast30Days: [{ code: 'test medicine', count: 1 }],
    medicationClassesLast30Days: [{ code: 'nsaid', count: 1 }],
    medicationEffectivenessLast30Days: [{ code: '3', count: 1 }],
    linkedMedicationEntriesLast30Days: 1,
    ongoingAttackAtCutoff: false,
  }
  db.users.insertOne({ _id: new ObjectId('507f1f77bcf86cd799439011'), latitude: 55.75, longitude: 37.62, city: 'Synthetic city' })
  db.risk_model_consent_policy.insertOne({ _id: 'current', version: 'shared-model-pilot-v2', digest: 'a'.repeat(64) })
  db.risk_model_participation.insertMany([
    { _id: 'v3-participant', userId: '507f1f77bcf86cd799439011', participating: true,
      consentVersion: 'shared-model-pilot-v2', consentDigest: 'a'.repeat(64) },
    { _id: 'old-participant', userId: 'old-user', participating: true,
      consentVersion: 'shared-model-pilot-v1', consentDigest: 'a'.repeat(64) },
  ])
  db.risk_training_input_snapshots.insertMany([threeDaysAgo, twoDaysAgo, yesterday].map(target => ({
    userId: '507f1f77bcf86cd799439011', targetDate: target, capturedAt: captured(target), timezone: 'UTC',
    locationKey: '55.75,37.62', baselineScore: 42, baselineLevel: 'MEDIUM',
    featureSchemaVersion: 3, scoringVersion: 'personal-rules-v1', features, historyDetails,
  })))
  db.attacks.insertOne({ _id: 'v3-attack', userId: '507f1f77bcf86cd799439011', startDate: twoDaysAgo,
    startTime: '10:15:00', endDate: yesterday, endTime: '11:45:00', ongoing: false,
    intensity: 7, type: 'PULSATING', symptoms: ['nausea'], triggers: ['stress'],
    painZones: { forehead: 'red' }, note: 'private note must stay in diary' })
  db.medications.insertOne({ _id: 'v3-med', userId: '507f1f77bcf86cd799439011', date: yesterday,
    time: '11:00:00', name: 'test medicine', therapeuticClass: 'nsaid', purpose: 'acute',
    attackId: 'v3-attack', effectiveness: 3, note: 'private medicine note' })
  db.risk_daily_outcomes.insertOne({ userId: '507f1f77bcf86cd799439011', date: threeDaysAgo })
  const oldDay = new Date('2020-01-01T00:00:00Z')
  db.attacks.insertOne({ _id: 'backdated-attack', userId: '507f1f77bcf86cd799439011', startDate: oldDay, endDate: oldDay,
    startTime: '09:00:00', endTime: '09:00:00', ongoing: false, intensity: 4, symptoms: ['photophobia'],
    painZones: { forehead: 'yellow' }, createdAt: now, note: 'private backdated note' })
  db.medications.insertOne({ _id: 'backdated-med', userId: '507f1f77bcf86cd799439011', date: oldDay,
    name: 'Ибупрофен', attackId: 'backdated-attack', effectiveness: null })
  print('Seeded three synthetic version-3 participant-days')
})()
