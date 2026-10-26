// Run with mongosh against `calm`, or with explicit test mode against the fixed synthetic source DB.
(() => {
  let phase = 'validate configuration'
  try {
  const source = db
  const testMode = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  const sourceName = testMode ? 'calm_risk_pipeline_test_source' : 'calm'
  const trainingName = testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const consentVersion = process.env.CALM_RISK_CONSENT_VERSION ||
    (testMode ? 'shared-model-pilot-v2' : '')
  const consentDigest = process.env.CALM_RISK_CONSENT_DIGEST || (testMode ? 'a'.repeat(64) : '')
  const featureSchemaVersion = 3
  const scoringVersion = 'personal-rules-v1'
  const trainingUri = process.env.CALM_TRAINING_MONGO_URI
  const pseudonymKey = process.env.CALM_TRAINING_HMAC_KEY
  const rebuildConfirmed = process.env.CALM_TRAINING_REBUILD_CONFIRM === 'YES'

  phase = 'check source database'
  if (source.getName() !== sourceName) throw new Error(`Connect to source DB '${sourceName}'`)
  phase = 'check training URI'
  if (typeof trainingUri !== 'string' || trainingUri.length === 0) {
    throw new Error('Set CALM_TRAINING_MONGO_URI before running the export')
  }
  const uriWithoutOptions = trainingUri.split('?')[0]
  if (!/^mongodb(?:\+srv)?:\/\//.test(trainingUri) ||
      !uriWithoutOptions.endsWith(`/${trainingName}`)) {
    throw new Error(`Set CALM_TRAINING_MONGO_URI to a destination URI ending in /${trainingName}`)
  }
  phase = 'check HMAC key'
  if (!pseudonymKey || Buffer.byteLength(pseudonymKey, 'utf8') < 32) {
    throw new Error('Set CALM_TRAINING_HMAC_KEY to a secret of at least 32 bytes')
  }
  phase = 'check consent policy'
  if (!consentVersion || !/^[a-f0-9]{64}$/.test(consentDigest)) {
    throw new Error('Set CALM_RISK_CONSENT_VERSION and a 64-character CALM_RISK_CONSENT_DIGEST')
  }
  phase = 'check rebuild confirmation'
  if (!rebuildConfirmed) {
    throw new Error('Set CALM_TRAINING_REBUILD_CONFIRM=YES to replace the active training snapshot')
  }

  const crypto = require('crypto')
  phase = 'verify current source policy'
  if (!testMode) {
    const currentPolicy = source.risk_model_consent_policy.findOne({ _id: 'current' })
    if (!currentPolicy || currentPolicy.version !== consentVersion || currentPolicy.digest !== consentDigest) {
      throw new Error('Configured consent version or digest does not match the current backend policy')
    }
  }
  phase = 'connect to training database'
  const training = new Mongo(trainingUri).getDB(trainingName)
  phase = 'read consenting participants'
  const participationQuery = {
    participating: true,
    adminBlocked: { $ne: true },
    consentVersion,
  }
  if (!testMode) participationQuery.consentDigest = consentDigest
  const participants = source.risk_model_participation.find(participationQuery).toArray()
  const userIds = participants.map(p => p.userId).filter(id => typeof id === 'string' && id.length > 0)
  const participantKey = userId => crypto.createHmac('sha256', pseudonymKey)
    .update(userId, 'utf8').digest('hex')
  const attackKey = (userId, attackId) => crypto.createHmac('sha256', pseudonymKey)
    .update(`${userId}\u001fattack\u001f${String(attackId)}`, 'utf8').digest('hex')
  const locationGrid = key => {
    const match = typeof key === 'string' && key.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)
    if (!match) return null
    return `${Number(match[1]).toFixed(1)},${Number(match[2]).toFixed(1)}`
  }

  const dateKey = value => {
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
    return null
  }
  const localDateKey = (instant, timezone) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(instant)
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  }
  const localDayStart = (key, timezone) => {
    const [year, month, day] = key.split('-').map(Number)
    let guess = new Date(Date.UTC(year, month - 1, day))
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(guess)
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
      const asUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day),
        Number(values.hour), Number(values.minute), Number(values.second))
      const offset = asUtc - guess.getTime()
      guess = new Date(Date.UTC(year, month - 1, day) - offset)
    }
    return guess
  }
  const validHistoryFeatures = features => {
    const starts14 = features?.attackStartsLast14Days
    const starts30 = features?.attackStartsLast30Days
    const mean = features?.meanAttackIntensityLast30Days
    const daysSince = features?.daysSinceLastAttackStart
    return Number.isInteger(starts14) && starts14 >= 0 && starts14 <= 14 &&
      Number.isInteger(starts30) && starts30 >= starts14 && starts30 <= 30 &&
      (mean == null || (typeof mean === 'number' && mean >= 1 && mean <= 10)) &&
      (daysSince == null || (Number.isInteger(daysSince) && daysSince >= 1 && daysSince <= 90)) &&
      (starts30 > 0 || mean == null) &&
      (starts30 === 0 || (daysSince != null && daysSince <= 30))
  }
  const validHistoryDetails = details => {
    if (!details || typeof details.ongoingAttackAtCutoff !== 'boolean' ||
        !Number.isInteger(details.linkedMedicationEntriesLast30Days) ||
        details.linkedMedicationEntriesLast30Days < 0) return false
    return ['painTypesLast30Days', 'symptomsLast30Days', 'triggersLast30Days',
      'painZonesLast30Days', 'medicationNamesLast30Days', 'medicationClassesLast30Days',
      'medicationEffectivenessLast30Days'].every(name =>
      Array.isArray(details[name]) && details[name].every(item =>
        typeof item.code === 'string' && item.code.length > 0 &&
        Number.isInteger(item.count) && item.count > 0))
  }

  const now = new Date()
  const todayByZone = new Map()
  const latestByUserDay = new Map()
  const attacksByUser = new Map()
  const medicationsByUser = new Map()
  const noAttackDays = new Set()

  const personalLabel = 'Свой препарат'
  const publicMedicationNames = new Set([
    'Суматриптан', 'Золмитриптан', 'Элетриптан', 'Нурофен', 'Ибупрофен',
    'Найз', 'Аспирин', 'Парацетамол', 'Кетопрофен', 'Нурофен Экспресс',
    'Аспирин УПСА', 'Имигран спрей', 'Золмитриптан спрей',
  ].map(name => name.toLowerCase()))
  for (const entry of source.dictionaries.find({ type: 'MEDICATION_PRESET' }).toArray()) {
    if (entry.label) publicMedicationNames.add(entry.label.toLowerCase())
    if (entry.value) publicMedicationNames.add(entry.value.toLowerCase())
  }
  const personalNamesByUser = new Map()
  const addPersonalName = (userId, name) => {
    if (!userId || typeof name !== 'string') return
    if (!personalNamesByUser.has(userId)) personalNamesByUser.set(userId, new Set())
    personalNamesByUser.get(userId).add(name.toLowerCase())
  }
  for (const personal of source.personal_medications.find({ userId: { $in: userIds } }).toArray()) {
    addPersonalName(personal.userId, personal.name)
  }
  const trainingMedicationName = medication =>
    medication.personalMedicationId || medication.category === 'Другое'
      ? personalLabel : medication.name ?? null
  const safeHistoryDetails = (details, userId) => {
    const counts = new Map()
    for (const entry of details.medicationNamesLast30Days) {
      const normalized = entry.code.toLowerCase()
      const code = publicMedicationNames.has(normalized) && !personalNamesByUser.get(userId)?.has(normalized)
        ? entry.code : personalLabel
      counts.set(code, (counts.get(code) ?? 0) + entry.count)
    }
    return {
      ...details,
      medicationNamesLast30Days: [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, count]) => ({ code, count })),
    }
  }

  if (userIds.length > 0) {
    phase = 'read labeled days and forecasts'
    for (const outcome of source.risk_daily_outcomes.find({ userId: { $in: userIds } }).toArray()) {
      const key = dateKey(outcome.date)
      if (key) noAttackDays.add(`${outcome.userId}\u001f${key}`)
    }
    for (const attack of source.attacks.find({ userId: { $in: userIds } }).toArray()) {
      const start = dateKey(attack.startDate)
      if (!start) continue
      const end = dateKey(attack.endDate) ?? (attack.ongoing ? null : start)
      if (!attacksByUser.has(attack.userId)) attacksByUser.set(attack.userId, [])
      attacksByUser.get(attack.userId).push({ ...attack, start, end })
    }
    for (const medication of source.medications.find({ userId: { $in: userIds } }).toArray()) {
      if (medication.category === 'Другое' && !medication.personalMedicationId) {
        addPersonalName(medication.userId, medication.name)
      }
      const date = dateKey(medication.date)
      if (!date) continue
      if (!medicationsByUser.has(medication.userId)) medicationsByUser.set(medication.userId, [])
      medicationsByUser.get(medication.userId).push({ ...medication, day: date })
    }

    // Version 3 uses immutable pre-day training snapshots, including diary history.
    phase = 'select pre-day training inputs'
    const snapshots = source.risk_training_input_snapshots.find({ userId: { $in: userIds } }).toArray()
    for (const snapshot of snapshots) {
      const day = dateKey(snapshot.targetDate)
      if (!day || !snapshot.capturedAt || !snapshot.timezone || !locationGrid(snapshot.locationKey) ||
          snapshot.featureSchemaVersion !== featureSchemaVersion ||
          snapshot.scoringVersion !== scoringVersion ||
          !validHistoryFeatures(snapshot.features) ||
          !validHistoryDetails(snapshot.historyDetails)) continue
      let today = todayByZone.get(snapshot.timezone)
      if (!today) {
        try {
          today = localDateKey(now, snapshot.timezone)
          todayByZone.set(snapshot.timezone, today)
        } catch (_) { continue }
      }
      if (day >= today) continue
      let dayStart
      try { dayStart = localDayStart(day, snapshot.timezone) }
      catch (_) { continue }
      const capturedAt = new Date(snapshot.capturedAt)
      if (Number.isNaN(capturedAt.getTime()) || capturedAt >= dayStart) continue
      const key = `${snapshot.userId}\u001f${day}`
      latestByUserDay.set(key, {
        userId: snapshot.userId, day, issuedAt: capturedAt,
        timezone: snapshot.timezone, locationGrid: locationGrid(snapshot.locationKey),
        historyDetails: snapshot.historyDetails,
        prediction: {
          score: snapshot.baselineScore,
          level: snapshot.baselineLevel,
          scoringVersion: snapshot.scoringVersion,
          featureSchemaVersion: snapshot.featureSchemaVersion,
          features: snapshot.features,
        },
      })
    }
  }

  const examples = []
  phase = 'prepare training rows'
  const includedParticipants = new Set()
  for (const { prediction, day, userId, timezone, locationGrid: grid, historyDetails } of latestByUserDay.values()) {
    const key = `${userId}\u001f${day}`
    const dayAttacks = (attacksByUser.get(userId) ?? [])
      .filter(attack => attack.start <= day && (attack.end == null || attack.end >= day))
    const attackCount = dayAttacks.length
    if (attackCount === 0 && !noAttackDays.has(key)) continue

    const features = prediction.features
    const dayMedications = (medicationsByUser.get(userId) ?? [])
      .filter(medication => medication.day === day)
    const attacks = dayAttacks.map(attack => ({
      attackKey: attackKey(userId, attack._id),
      intensity: attack.intensity ?? null,
      painType: attack.type ?? null,
      startDate: attack.start,
      startTime: attack.startTime == null ? null : String(attack.startTime).slice(0, 5),
      endDate: dateKey(attack.endDate),
      endTime: attack.endTime == null ? null : String(attack.endTime).slice(0, 5),
      ongoing: Boolean(attack.ongoing),
      symptoms: Array.isArray(attack.symptoms) ? attack.symptoms : [],
      triggers: Array.isArray(attack.triggers) ? attack.triggers : [],
      painZones: Object.entries(attack.painZones ?? {}).map(([zone, color]) => ({ zone, color })),
      medicationTaken: dayMedications.some(medication =>
        medication.attackId != null && String(medication.attackId) === String(attack._id)),
    }))
    const medications = dayMedications.map(medication => ({
      time: medication.time == null ? null : String(medication.time).slice(0, 5),
      name: trainingMedicationName(medication),
      therapeuticClass: medication.therapeuticClass ?? null,
      purpose: medication.purpose ?? null,
      effectiveness: medication.effectiveness ?? null,
      linkedAttackKey: medication.attackId == null ? null : attackKey(userId, medication.attackId),
    }))
    examples.push({
      _id: null,
      generation: null,
      participantKey: participantKey(userId),
      targetDate: day,
      outcome: attackCount > 0 ? 1 : 0,
      outcomeDefinition: 'attack-present-anytime-v1',
      attackCount,
      forecastTimezone: timezone,
      locationGrid: grid,
      diaryOutcome: { attacks, medications },
      historyDetails: safeHistoryDetails(historyDetails, userId),
      binaryPrediction: null,
      predictionMatched: null,
      baselineScore: prediction.score,
      baselineLevel: prediction.level,
      scoringVersion: prediction.scoringVersion,
      featureSchemaVersion: prediction.featureSchemaVersion,
      features: {
        weatherScore: features.weatherScore ?? null,
        pressureMmHg: features.pressureMmHg ?? null,
        pressureDelta24hMmHg: features.pressureDelta24hMmHg ?? null,
        humidity: features.humidity ?? null,
        humidityDelta24h: features.humidityDelta24h ?? null,
        tempMin: features.tempMin ?? null,
        tempMax: features.tempMax ?? null,
        windKmhMax: features.windKmhMax ?? null,
        kpIndex: features.kpIndex ?? null,
        attacksLast3Days: features.attacksLast3Days,
        attacksLast7Days: features.attacksLast7Days,
        medicationDaysLast7Days: features.medicationDaysLast7Days,
        overuseRisk: features.overuseRisk,
        historyDays: features.historyDays,
        historyAttackDays: features.historyAttackDays,
        attackStartsLast14Days: features.attackStartsLast14Days,
        attackStartsLast30Days: features.attackStartsLast30Days,
        meanAttackIntensityLast30Days: features.meanAttackIntensityLast30Days ?? null,
        daysSinceLastAttackStart: features.daysSinceLastAttackStart ?? null,
      },
    })
    includedParticipants.add(participantKey(userId))
  }

  const generation = `${now.toISOString().replace(/[-:.TZ]/g, '')}_${crypto.randomBytes(8).toString('hex')}`
  for (const example of examples) {
    example.generation = generation
    example._id = `${generation}_${example.participantKey}_${example.targetDate}`
  }

  if (examples.length > 0) {
    phase = 'write staging generation'
    training.training_examples.insertMany(examples, { ordered: false })
    const insertedCount = training.training_examples.countDocuments({ generation })
    if (insertedCount !== examples.length) {
      throw new Error(`Staging generation incomplete: expected ${examples.length}, found ${insertedCount}`)
    }
  }

  phase = 'publish generation'
  training.export_metadata.replaceOne({ _id: 'active' }, {
    _id: 'active',
    generation,
    generatedAt: now,
    consentVersion,
    consentDigest,
    featureSchemaVersion,
    scoringVersion,
    outcomeDefinition: 'attack-present-anytime-v1',
    detailSchemaVersion: 1,
    exampleCount: examples.length,
    participantCount: includedParticipants.size,
    outcomeDays: { attackPresent: examples.filter(e => e.outcome === 1).length,
      noAttack: examples.filter(e => e.outcome === 0).length },
  }, { upsert: true })

  // Publish the completed generation first; remove rows and offline artifacts built from old data.
  training.training_examples.deleteMany({ generation: { $ne: generation } })
  training.risk_model_candidates.deleteMany({ generation: { $ne: generation } })
  training.risk_model_evaluations.deleteMany({ generation: { $ne: generation } })
  print(`Published ${examples.length} examples from ${includedParticipants.size} consenting participants to ${trainingName}`)
  } catch (error) {
    print(`Training export failed during '${phase}': ${error.name}`)
    if (process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES' || phase.startsWith('check ')) {
      if (error.stack) print(error.stack)
      throw error
    }
    throw new Error(`Training export stopped during '${phase}'`)
  }
})()
