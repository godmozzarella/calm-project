// Read-only comparison of diary source records and the currently published training snapshot.
// Without CALM_AUDIT_USER_ID/CALM_AUDIT_DATE prints aggregate counts only.
(() => {
  const testMode = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  const sourceName = testMode ? 'calm_risk_pipeline_test_source' : 'calm'
  const trainingName = testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const trainingUri = process.env.CALM_TRAINING_MONGO_URI
  const hmacKey = process.env.CALM_TRAINING_HMAC_KEY
  const requestedUserId = process.env.CALM_AUDIT_USER_ID
  const requestedEmail = process.env.CALM_AUDIT_EMAIL
  const day = process.env.CALM_AUDIT_DATE

  if (db.getName() !== sourceName) throw new Error(`Connect to ${sourceName}`)
  if (!trainingUri || !trainingUri.split('?')[0].endsWith(`/${trainingName}`)) {
    throw new Error(`CALM_TRAINING_MONGO_URI must point to ${trainingName}`)
  }
  if (!hmacKey || Buffer.byteLength(hmacKey, 'utf8') < 32) {
    throw new Error('CALM_TRAINING_HMAC_KEY is required')
  }
  if (requestedUserId && requestedEmail) throw new Error('Select by either user ID or email')
  if (Boolean(requestedUserId || requestedEmail) !== Boolean(day)) {
    throw new Error('Set CALM_AUDIT_DATE with CALM_AUDIT_USER_ID or CALM_AUDIT_EMAIL')
  }
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('CALM_AUDIT_DATE must be YYYY-MM-DD')

  const source = db
  const userId = requestedUserId || (requestedEmail
    ? source.users.findOne({ email: requestedEmail }, { _id: 1 })?._id?.toString() : null)
  if (requestedEmail && !userId) throw new Error('User not found')
  const training = new Mongo(trainingUri).getDB(trainingName)
  const crypto = require('crypto')
  const dateKey = value => value instanceof Date ? value.toISOString().slice(0, 10)
    : typeof value === 'string' ? value.slice(0, 10) : null
  const attackOnDay = (attack, key) => {
    const start = dateKey(attack.startDate)
    const end = dateKey(attack.endDate) ?? (attack.ongoing ? null : start)
    return Boolean(start && start <= key && (end == null || end >= key))
  }
  const participantKey = id => crypto.createHmac('sha256', hmacKey).update(id).digest('hex')
  const metadata = training.export_metadata.findOne({ _id: 'active' })
  const generation = metadata?.generation ?? null
  const activeRows = generation ? training.training_examples.find({ generation },
    { participantKey: 1, targetDate: 1, outcome: 1 }).toArray() : []
  const exportedKeys = new Set(activeRows.map(row => `${row.participantKey}\u001f${row.targetDate}`))
  const policy = source.risk_model_consent_policy.findOne({ _id: 'current' })
  const activeParticipants = source.risk_model_participation.find({
    participating: true,
    adminBlocked: { $ne: true },
    consentVersion: policy?.version,
    consentDigest: policy?.digest,
  }, { userId: 1 }).toArray().filter(row => typeof row.userId === 'string')
  const activeIds = activeParticipants.map(row => row.userId)
  const labeledKeys = new Set()
  const today = new Date().toISOString().slice(0, 10)
  for (const attack of source.attacks.find({ userId: { $in: activeIds } },
    { userId: 1, startDate: 1, endDate: 1, ongoing: 1 })) {
    const start = dateKey(attack.startDate)
    if (!start) continue
    const end = dateKey(attack.endDate) ?? (attack.ongoing ? today : start)
    for (let cursor = new Date(`${start}T00:00:00Z`); cursor.toISOString().slice(0, 10) <= end;
      cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      labeledKeys.add(`${participantKey(attack.userId)}\u001f${cursor.toISOString().slice(0, 10)}`)
    }
  }
  for (const outcome of source.risk_daily_outcomes.find({ userId: { $in: activeIds } }, { userId: 1, date: 1 })) {
    const key = dateKey(outcome.date)
    if (key) labeledKeys.add(`${participantKey(outcome.userId)}\u001f${key}`)
  }
  const missingRows = [...labeledKeys].filter(key => !exportedKeys.has(key)).length
  const ageMinutes = metadata?.generatedAt ? Math.round((Date.now() - new Date(metadata.generatedAt).getTime()) / 60000) : null
  const summary = {
    source: {
      accounts: source.users.countDocuments({}),
      attacks: source.attacks.countDocuments({}),
      medicationEntries: source.medications.countDocuments({}),
      confirmedNoAttackDays: source.risk_daily_outcomes.countDocuments({}),
      savedPredictions: source.risk_prediction_records.countDocuments({}),
      automaticInputSnapshots: source.risk_training_input_snapshots.countDocuments({}),
      sharedWeatherSnapshots: source.forecast_snapshots.countDocuments({}),
      participantsWithCurrentConsent: activeIds.length,
      recordedLabeledParticipantDays: labeledKeys.size,
    },
    dataset: {
      generation,
      outcomeDefinition: metadata?.outcomeDefinition ?? null,
      detailSchemaVersion: metadata?.detailSchemaVersion ?? null,
      generatedAt: metadata?.generatedAt ?? null,
      ageMinutes,
      stale: ageMinutes == null || ageMinutes > 15,
      rows: activeRows.length,
      attackDays: activeRows.filter(row => row.outcome === 1).length,
      noAttackDays: activeRows.filter(row => row.outcome === 0).length,
      recordedLabeledDaysWithoutRow: missingRows,
    },
  }

  if (!userId) {
    print(JSON.stringify(summary, null, 2))
    return
  }

  const user = source.users.findOne({ _id: userId }, { latitude: 1, longitude: 1, city: 1 })
  if (!user) throw new Error('User not found')
  const participation = source.risk_model_participation.findOne({ userId },
    { participating: 1, consentVersion: 1, consentDigest: 1, adminBlocked: 1 })
  const consentCurrent = Boolean(participation?.participating && !participation?.adminBlocked &&
    participation.consentVersion === policy?.version && participation.consentDigest === policy?.digest)
  const attacks = source.attacks.find({ userId }).toArray().filter(a => attackOnDay(a, day))
  const medications = source.medications.find({ userId }).toArray().filter(m => dateKey(m.date) === day)
  const outcome = source.risk_daily_outcomes.find({ userId }).toArray()
    .find(item => dateKey(item.date) === day)
  const predictions = source.risk_prediction_records.find({ userId }).toArray()
    .filter(p => dateKey(p.targetDate) === day)
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
  const latestPrediction = predictions[0] ?? null
  const automaticInput = source.risk_training_input_snapshots.find({ userId }).toArray()
    .find(item => dateKey(item.targetDate) === day)
  const key = participantKey(userId)
  const row = generation ? training.training_examples.findOne({ generation, participantKey: key, targetDate: day }) : null
  const medView = m => ({
    date: dateKey(m.date), time: m.time ?? null, name: m.name ?? null,
    dosage: m.dosage ?? null, attackId: m.attackId ?? null,
    effectiveness: m.effectiveness ?? null,
  })
  print(JSON.stringify({
    summary,
    selectedDay: day,
    currentProfileLocation: { city: user.city ?? null, latitude: user.latitude ?? null,
      longitude: user.longitude ?? null },
    consentCurrent,
    diary: {
      attackCount: attacks.length,
      attacks: attacks.map(a => ({
        id: String(a._id), intensity: a.intensity, type: a.type,
        startDate: dateKey(a.startDate), startTime: a.startTime,
        endDate: dateKey(a.endDate), endTime: a.endTime, ongoing: a.ongoing,
        symptoms: a.symptoms ?? [], triggers: a.triggers ?? [], painZones: a.painZones ?? {},
        linkedMedications: medications.filter(m => m.attackId === String(a._id)).map(medView),
      })),
      unlinkedMedications: medications.filter(m => !m.attackId || !attacks.some(a => String(a._id) === m.attackId)).map(medView),
      confirmedNoAttack: Boolean(outcome),
    },
    observedY: attacks.length ? 1 : outcome ? 0 : null,
    savedPrediction: latestPrediction ? {
      issuedAt: latestPrediction.issuedAt, timezone: latestPrediction.timezone,
      rulesScore: latestPrediction.score, level: latestPrediction.level,
      pressureUnit: latestPrediction.featureSchemaVersion >= 3 ? 'mmHg' : 'hPa (legacy)',
      weatherAndHistoryFeatures: latestPrediction.features ?? null,
    } : null,
    automaticInput: automaticInput ? {
      capturedAt: automaticInput.capturedAt, timezone: automaticInput.timezone,
      locationKey: automaticInput.locationKey, rulesScore: automaticInput.baselineScore,
      level: automaticInput.baselineLevel, weatherAndHistoryFeatures: automaticInput.features,
      pressureUnit: automaticInput.featureSchemaVersion >= 3 ? 'mmHg' : 'hPa (legacy)',
      historyDetails: automaticInput.historyDetails ?? null,
    } : null,
    binaryPrediction: null,
    predictionMatched: null,
    datasetRow: row ? {
      targetDate: row.targetDate, y: row.outcome, attackCount: row.attackCount,
      outcomeDefinition: row.outcomeDefinition, baselineScore: row.baselineScore,
      baselineLevel: row.baselineLevel, scoringVersion: row.scoringVersion,
      featureSchemaVersion: row.featureSchemaVersion,
      pressureUnit: row.featureSchemaVersion >= 3 ? 'mmHg' : 'hPa (legacy)',
      forecastTimezone: row.forecastTimezone ?? null, locationGrid: row.locationGrid ?? null,
      historyDetails: row.historyDetails ?? null, diaryOutcome: row.diaryOutcome ?? null,
      binaryPrediction: row.binaryPrediction ?? null, predictionMatched: row.predictionMatched ?? null,
      features: row.features,
    } : null,
  }, null, 2))
})()
