// Run with mongosh against `calm`, or with explicit test mode against the fixed synthetic source DB.
(() => {
  let phase = 'validate configuration'
  try {
  const source = db
  const testMode = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  const sourceName = testMode ? 'calm_risk_pipeline_test_source' : 'calm'
  const trainingName = testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const consentVersion = process.env.CALM_RISK_CONSENT_VERSION ||
    (testMode ? 'shared-model-pilot-v1' : '')
  const consentDigest = process.env.CALM_RISK_CONSENT_DIGEST || (testMode ? 'a'.repeat(64) : '')
  const featureSchemaVersion = 2
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
    consentVersion,
  }
  if (!testMode) participationQuery.consentDigest = consentDigest
  const participants = source.risk_model_participation.find(participationQuery).toArray()
  const userIds = participants.map(p => p.userId).filter(id => typeof id === 'string' && id.length > 0)
  const participantKey = userId => crypto.createHmac('sha256', pseudonymKey)
    .update(userId, 'utf8').digest('hex')

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

  const now = new Date()
  const todayByZone = new Map()
  const latestByUserDay = new Map()
  const attackDays = new Set()
  const noAttackDays = new Set()

  if (userIds.length > 0) {
    phase = 'read labeled days and forecasts'
    for (const outcome of source.risk_daily_outcomes.find({ userId: { $in: userIds } }).toArray()) {
      const key = dateKey(outcome.date)
      if (key) noAttackDays.add(`${outcome.userId}\u001f${key}`)
    }
    for (const attack of source.attacks.find({ userId: { $in: userIds } }, { userId: 1, startDate: 1 }).toArray()) {
      const key = dateKey(attack.startDate)
      if (key) attackDays.add(`${attack.userId}\u001f${key}`)
    }

    const predictions = source.risk_prediction_records.find({ userId: { $in: userIds } }).toArray()
    phase = 'select valid forecasts'
    for (const prediction of predictions) {
      const day = dateKey(prediction.targetDate)
      if (!day || !prediction.issuedAt || !prediction.timezone ||
          prediction.featureSchemaVersion !== featureSchemaVersion ||
          prediction.scoringVersion !== scoringVersion ||
          !validHistoryFeatures(prediction.features)) continue

      let today = todayByZone.get(prediction.timezone)
      if (!today) {
        try {
          today = localDateKey(now, prediction.timezone)
          todayByZone.set(prediction.timezone, today)
        } catch (_) {
          continue
        }
      }
      if (day >= today) continue

      let dayStart
      try { dayStart = localDayStart(day, prediction.timezone) }
      catch (_) { continue }

      const issuedAt = new Date(prediction.issuedAt)
      if (Number.isNaN(issuedAt.getTime()) || issuedAt >= dayStart) continue

      const key = `${prediction.userId}\u001f${day}`
      const previous = latestByUserDay.get(key)
      if (!previous || issuedAt > previous.issuedAt) {
        latestByUserDay.set(key, { prediction, day, issuedAt, userId: prediction.userId })
      }
    }
  }

  const examples = []
  phase = 'prepare training rows'
  const includedParticipants = new Set()
  for (const { prediction, day, userId } of latestByUserDay.values()) {
    const key = `${userId}\u001f${day}`
    const attackStarted = attackDays.has(key)
    if (!attackStarted && !noAttackDays.has(key)) continue

    const features = prediction.features
    examples.push({
      _id: null,
      generation: null,
      participantKey: participantKey(userId),
      targetDate: day,
      outcome: attackStarted ? 1 : 0,
      baselineScore: prediction.score,
      baselineLevel: prediction.level,
      scoringVersion: prediction.scoringVersion,
      featureSchemaVersion: prediction.featureSchemaVersion,
      features: {
        weatherScore: features.weatherScore ?? null,
        pressureHpa: features.pressureHpa ?? null,
        pressureDelta24h: features.pressureDelta24h ?? null,
        humidity: features.humidity ?? null,
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
    exampleCount: examples.length,
    participantCount: includedParticipants.size,
    outcomeDays: { attackStarted: examples.filter(e => e.outcome === 1).length,
      noAttackStarted: examples.filter(e => e.outcome === 0).length },
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
