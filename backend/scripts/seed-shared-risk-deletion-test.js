// Add user-owned test records to the isolated migration DB after API registration.
(() => {
  if (db.getName() !== 'calm_risk_pipeline_test_source') throw new Error('Wrong test source DB')
  const userId = process.env.CALM_RISK_DELETE_TEST_USER_ID
  const userMongoId = /^[a-f0-9]{24}$/.test(userId || '') ? ObjectId(userId) : userId
  if (!userId || db.users.countDocuments({ _id: userMongoId }) !== 1) throw new Error('Registered test user missing')
  if (db.auth_sessions.countDocuments({ userId }) < 1) throw new Error('Registered session missing')
  const prefix = 'delete-test-'
  if (db.risk_model_participation.countDocuments({ userId }) !== 0) throw new Error('Test user already seeded')

  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const day = new Date(today.getTime() - 2 * 86_400_000)
  db.attacks.insertOne({ _id: `${prefix}attack`, userId,
    startDate: new Date(today.getTime() - 3 * 86_400_000) })
  db.medications.insertOne({ _id: `${prefix}medication`, userId, name: 'test-only' })
  db.risk_daily_outcomes.insertOne({ _id: `${prefix}outcome`, userId, date: day })
  db.risk_model_participation.insertOne({ _id: `${prefix}participation`, userId,
    participating: true, consentVersion: 'shared-model-pilot-v1' })
  db.risk_prediction_records.insertOne({ _id: `${prefix}prediction`, userId,
    targetDate: day, issuedAt: new Date(day.getTime() - 86_400_000), timezone: 'UTC',
    score: 45, level: 'MEDIUM', featureSchemaVersion: 2,
    scoringVersion: 'personal-rules-v1',
    features: {
      weatherScore: 30, pressureHpa: 1012, pressureDelta24h: -2, humidity: 60,
      tempMin: 8, tempMax: 15, windKmhMax: 10, kpIndex: 2,
      attacksLast3Days: 1, attacksLast7Days: 1, medicationDaysLast7Days: 1,
      overuseRisk: false, historyDays: 20, historyAttackDays: 2,
      attackStartsLast14Days: 1, attackStartsLast30Days: 2,
      meanAttackIntensityLast30Days: 5, daysSinceLastAttackStart: 3,
    } })
  print('Seeded source-owned records for the registered deletion-test account')
})()
