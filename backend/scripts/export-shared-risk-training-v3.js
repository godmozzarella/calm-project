// Run with mongosh against `calm`, or with explicit test mode against the fixed synthetic source DB.
(async () => {
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
  const trainingMedicationName = medication => {
    const normalized = typeof medication.name === 'string' ? medication.name.toLowerCase() : ''
    if (!normalized) return medication.personalMedicationId ? personalLabel : null
    const personalNames = personalNamesByUser.get(medication.userId)
    return medication.personalMedicationId || medication.category === 'Другое' ||
      !publicMedicationNames.has(normalized) || (personalNames && personalNames.has(normalized))
      ? personalLabel : medication.name
  }
  const safeHistoryDetails = (details, userId) => {
    if (!details || typeof details !== 'object') return null
    const result = {}
    for (const field of ['painTypesLast30Days', 'symptomsLast30Days', 'triggersLast30Days',
      'painZonesLast30Days', 'medicationClassesLast30Days', 'medicationEffectivenessLast30Days']) {
      result[field] = Array.isArray(details[field]) ? details[field].map(item => ({ code: item.code ?? null, count: item.count ?? null })) : null
    }
    result.linkedMedicationEntriesLast30Days = details.linkedMedicationEntriesLast30Days ?? null
    result.ongoingAttackAtCutoff = details.ongoingAttackAtCutoff ?? null
    const counts = new Map()
    if (Array.isArray(details.medicationNamesLast30Days)) {
      const privateNames = personalNamesByUser.get(userId)
      for (const entry of details.medicationNamesLast30Days) {
        const normalized = typeof entry.code === 'string' ? entry.code.toLowerCase() : ''
        const code = !normalized ? null : publicMedicationNames.has(normalized) && !(privateNames && privateNames.has(normalized)) ? entry.code : personalLabel
        const count = Number.isFinite(entry.count) ? entry.count : null
        counts.set(code, count == null ? null : (counts.get(code) ?? 0) + count)
      }
      result.medicationNamesLast30Days = [...counts.entries()].map(([code, count]) => ({ code, count }))
    } else result.medicationNamesLast30Days = null
    return result
  }

  if (userIds.length > 0) {
    phase = 'read labeled days and forecasts'
    for (const outcome of source.risk_daily_outcomes.find({ userId: { $in: userIds } }).toArray()) {
      const key = dateKey(outcome.date)
      if (key) {
        noAttackDays.add(`${outcome.userId}\u001f${key}`)

      }
    }
    for (const attack of source.attacks.find({ userId: { $in: userIds } }).toArray()) {
      const start = dateKey(attack.startDate)
      const end = dateKey(attack.endDate) ?? (attack.ongoing ? null : start)
      if (!attacksByUser.has(attack.userId)) attacksByUser.set(attack.userId, [])
      attacksByUser.get(attack.userId).push({ ...attack, start, end })
    }
    for (const medication of source.medications.find({ userId: { $in: userIds } }).toArray()) {
      if (medication.category === 'Другое' && !medication.personalMedicationId) {
        addPersonalName(medication.userId, medication.name)
      }
      const date = dateKey(medication.date)
      if (!medicationsByUser.has(medication.userId)) medicationsByUser.set(medication.userId, [])
      medicationsByUser.get(medication.userId).push({ ...medication, day: date })
    }

    // Keep every available v3 snapshot, including partial/late ones, and expose its timing.
    for (const snapshot of source.risk_training_input_snapshots.find({ userId: { $in: userIds } }).toArray()) {
      const day = dateKey(snapshot.targetDate)
      if (!day || snapshot.featureSchemaVersion !== featureSchemaVersion) continue
      const captured = snapshot.capturedAt ? new Date(snapshot.capturedAt) : null
      const capturedAt = captured && !Number.isNaN(captured.getTime()) ? captured : null
      let timezone = null
      let preDay = false
      try {
        if (typeof snapshot.timezone === 'string') {
          const start = localDayStart(day, snapshot.timezone)
          timezone = snapshot.timezone
          preDay = Boolean(capturedAt && capturedAt < start)
        }
      } catch (_) { /* Unknown timezone remains an explicit missing value. */ }
      const key = `${snapshot.userId}\u001f${day}`
      const previous = latestByUserDay.get(key)
      if (previous && previous.issuedAt && (!capturedAt || previous.issuedAt >= capturedAt)) continue
      latestByUserDay.set(key, {
        userId: snapshot.userId, day, issuedAt: capturedAt, timezone,
        locationGrid: locationGrid(snapshot.locationKey), historyDetails: snapshot.historyDetails ?? null,
        snapshotTiming: preDay ? 'PRE_DAY' : capturedAt && timezone ? 'LATE' : 'UNKNOWN',
        completePreDay: preDay && Boolean(locationGrid(snapshot.locationKey)) &&
          snapshot.scoringVersion === scoringVersion && validHistoryFeatures(snapshot.features) &&
          validHistoryDetails(snapshot.historyDetails),
        prediction: { score: snapshot.baselineScore ?? null, level: snapshot.baselineLevel ?? null,
          scoringVersion: snapshot.scoringVersion ?? null, features: snapshot.features ?? {} },
      })
    }
  }

  // Candidate days come from the entire diary, not only from forecast snapshots.
  const candidateKeys = new Set()
  const addDay = (userId, day) => {
    const key = `${userId}\u001f${day ?? 'UNKNOWN_DATE'}`
    candidateKeys.add(key)
    if (!latestByUserDay.has(key)) latestByUserDay.set(key, {
      userId, day, issuedAt: null, timezone: null, locationGrid: null, historyDetails: null,
      snapshotTiming: 'MISSING', completePreDay: false,
      prediction: { score: null, level: null, scoringVersion: null, features: {} },
    })
  }
  const utcToday = now.toISOString().slice(0, 10)
  for (const [userId, attacks] of attacksByUser.entries()) {
    for (const attack of attacks) {
      addDay(userId, attack.start)
      if (!attack.start) continue
      const end = attack.end && attack.end < utcToday ? attack.end : utcToday
      const cursor = new Date(`${attack.start}T00:00:00Z`)
      while (!Number.isNaN(cursor.getTime()) && cursor.toISOString().slice(0, 10) <= end) {
        addDay(userId, cursor.toISOString().slice(0, 10))
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
  }
  for (const key of noAttackDays) {
    const [userId, day] = key.split('\u001f')
    addDay(userId, day)
  }
  for (const [userId, medications] of medicationsByUser.entries()) {
    for (const medication of medications) addDay(userId, medication.day)
  }

  const profileIds = [...userIds, ...userIds.filter(id => /^[a-fA-F0-9]{24}$/.test(id)).map(id => new ObjectId(id))]
  const profiles = new Map(source.users.find({ _id: { $in: profileIds } }).toArray().map(user => [String(user._id), user]))
  const resolveLocation = (userId, event) => {
    const frozen = event.eventLocation
    const profile = profiles.get(userId)
    let historical = null
    let historicalSource = 'LOCATION_HISTORY'
    const day = event.start || event.day || dateKey(event.startDate) || dateKey(event.date)
    if (!frozen && profile && profile.locationMode === 'AUTO' && day && Array.isArray(profile.locationHistory) && profile.locationHistory.length) {
      const history = profile.locationHistory.filter(entry => entry && entry.effectiveAt && entry.location)
        .sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt))
      let instant
      try {
        const time = String(event.startTime || event.time || '12:00').split(':').map(Number)
        instant = new Date(localDayStart(day, profile.locationTimezone || 'UTC').getTime() + ((time[0] || 0) * 60 + (time[1] || 0)) * 60000)
      } catch (_) { instant = new Date(`${day}T12:00:00Z`) }
      for (const entry of history) if (new Date(entry.effectiveAt) <= instant) historical = entry.location
      if (!historical && history.length) { historical = history[0].location; historicalSource = 'INITIAL_PROFILE_ASSUMPTION' }
    }
    const selected = frozen && frozen.latitude != null && frozen.longitude != null ? frozen : historical || profile
    if (!selected || selected.latitude == null || selected.longitude == null) return null
    return { locationGrid: locationGrid(`${selected.latitude},${selected.longitude}`),
      timezone: selected.locationTimezone || selected.timezone || null,
      source: frozen === selected ? frozen.source || 'EVENT_LOCATION' : historical ? historicalSource : 'PROFILE_ASSUMPTION' }
  }

  const examples = []
  phase = 'prepare training rows'
  const includedParticipants = new Set()
  for (const { prediction, day, userId, timezone, locationGrid: grid, historyDetails, snapshotTiming, completePreDay, issuedAt } of latestByUserDay.values()) {
    const key = `${userId}\u001f${day ?? 'UNKNOWN_DATE'}`
    if (!candidateKeys.has(key)) continue
    const dayAttacks = (attacksByUser.get(userId) ?? [])
      .filter(attack => day == null ? attack.start == null : attack.start != null && attack.start <= day && (attack.end == null || attack.end >= day))
    const attackCount = dayAttacks.length

    const features = prediction.features
    const dayMedications = (medicationsByUser.get(userId) ?? [])
      .filter(medication => medication.day === day)
    if (attackCount === 0 && !noAttackDays.has(key) && dayMedications.length === 0) continue
    const outcome = attackCount > 0 ? 1 : noAttackDays.has(key) ? 0 : null
    const today = timezone ? localDateKey(now, timezone) : utcToday
    const dayCompleted = day == null ? null : day < today ? true : false
    const medicationDetails = medication => ({
      date: medication.day, time: medication.time == null ? null : String(medication.time).slice(0, 5),
      location: resolveLocation(userId, medication),
      name: trainingMedicationName(medication), dosage: medication.dosage ?? null,
      category: medication.category ?? null, recordedAt: medication.createdAt ?? null,
      medicationKey: crypto.createHmac('sha256', pseudonymKey).update(`${userId}\u001fmedication\u001f${String(medication._id)}`, 'utf8').digest('hex'),
      intakeKey: medication.intakeId == null ? null : crypto.createHmac('sha256', pseudonymKey).update(`${userId}\u001fintake\u001f${String(medication.intakeId)}`, 'utf8').digest('hex'),
      therapeuticClass: medication.therapeuticClass ?? null,
      purpose: medication.purpose ?? null, effectiveness: medication.effectiveness ?? null,
      linkedAttackKey: medication.attackId == null ? null : attackKey(userId, medication.attackId),
    })
    const attacks = dayAttacks.map(attack => ({
      attackKey: attackKey(userId, attack._id),
      intensity: attack.intensity ?? null,
      painType: attack.type ?? null,
      startDate: attack.start,
      startTime: attack.startTime == null ? null : String(attack.startTime).slice(0, 5),
      endDate: dateKey(attack.endDate),
      endTime: attack.endTime == null ? null : String(attack.endTime).slice(0, 5),
      ongoing: typeof attack.ongoing === 'boolean' ? attack.ongoing : null,
      symptoms: Array.isArray(attack.symptoms) ? attack.symptoms : null,
      triggers: Array.isArray(attack.triggers) ? attack.triggers : null,
      painZones: attack.painZones == null ? null : Object.entries(attack.painZones).map(([zone, color]) => ({ zone, color })),
      recordedAt: attack.createdAt ?? null,
      location: resolveLocation(userId, attack),
      linkedMedications: (medicationsByUser.get(userId) ?? []).filter(medication => medication.attackId != null && String(medication.attackId) === String(attack._id)).map(medicationDetails),
      medicationTaken: (medicationsByUser.get(userId) ?? []).some(medication =>
        medication.attackId != null && String(medication.attackId) === String(attack._id)),
    }))
    const medications = dayMedications.map(medicationDetails)
    examples.push({
      _id: null,
      generation: null,
      participantKey: participantKey(userId),
      targetDate: day,
      outcome,
      snapshotTiming, snapshotCapturedAt: issuedAt,
      dayCompleted,
      trainingEligible: Boolean(completePreDay && dayCompleted && outcome != null),
      outcomeDefinition: 'attack-present-anytime-v1',
      attackCount,
      forecastTimezone: timezone,
      profileLocation: resolveLocation(userId, { day }),
      locationGrid: grid,
      diaryOutcome: { attacks, medications },
      historyDetails: safeHistoryDetails(historyDetails, userId),
      binaryPrediction: null,
      predictionMatched: null,
      baselineScore: prediction.score,
      baselineLevel: prediction.level,
      scoringVersion: prediction.scoringVersion,
      featureSchemaVersion,
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
        attacksLast3Days: features.attacksLast3Days ?? null,
        attacksLast7Days: features.attacksLast7Days ?? null,
        medicationDaysLast7Days: features.medicationDaysLast7Days ?? null,
        overuseRisk: features.overuseRisk ?? null,
        historyDays: features.historyDays ?? null,
        historyAttackDays: features.historyAttackDays ?? null,
        attackStartsLast14Days: features.attackStartsLast14Days ?? null,
        attackStartsLast30Days: features.attackStartsLast30Days ?? null,
        meanAttackIntensityLast30Days: features.meanAttackIntensityLast30Days ?? null,
        daysSinceLastAttackStart: features.daysSinceLastAttackStart ?? null,
      },
    })
    includedParticipants.add(participantKey(userId))
  }

  // Reuse published archive data; a bounded batch fills more history on each worker cycle.
  const oldMetadata = training.export_metadata.findOne({ _id: 'active' })
  const weatherCache = new Map()
  if (oldMetadata && oldMetadata.generation) {
    for (const row of training.training_examples.find({ generation: oldMetadata.generation }).toArray()) {
      const records = [row.historicalWeather, ...(row.diaryOutcome?.attacks || []).map(a => a.historicalWeather),
        ...(row.diaryOutcome?.medications || []).map(m => m.historicalWeather)]
      for (const weather of records) if (weather && weather.cacheKey) weatherCache.set(weather.cacheKey, weather)
    }
  }
  const requests = new Map()
  for (const row of examples) {
    const events = [...row.diaryOutcome.attacks, ...row.diaryOutcome.medications]
    if (!events.length) events.push({ location: row.profileLocation })
    for (const event of events) {
      const grid = event.location && event.location.locationGrid
      if (!grid || !row.targetDate || row.targetDate >= utcToday || row.targetDate < '1940-01-02') continue
      const key = `${grid}|${row.targetDate}`
      if (weatherCache.has(key)) continue
      const group = `${grid}|${row.targetDate.slice(0, 7)}`
      if (!requests.has(group)) requests.set(group, { grid, dates: new Set() })
      requests.get(group).dates.add(row.targetDate)
    }
  }
  const weatherBatchStarted = Date.now()
  let weatherRequests = 0
  let weatherFailures = 0
  if (!testMode && process.env.CALM_HISTORICAL_WEATHER_ENABLED !== 'false') {
    const archive = require('/scripts/historical-weather.cjs')
    const limit = Math.max(1, Math.min(100, Number(process.env.CALM_HISTORICAL_WEATHER_BATCH_SIZE) || 12))
    for (const request of requests.values()) {
      if (weatherRequests >= limit || Date.now() - weatherBatchStarted > 90000) break
      weatherRequests++
      try {
        const result = await archive.fetchDays(request.grid, [...request.dates])
        for (const weather of Object.values(result)) weatherCache.set(weather.cacheKey, weather)
      } catch (_) { weatherFailures++ }
    }
  }
  for (const row of examples) {
    const allEvents = [...row.diaryOutcome.attacks, ...row.diaryOutcome.medications]
    const grids = new Set(allEvents.map(event => event.location && event.location.locationGrid).filter(Boolean))
    if (!grids.size && row.profileLocation) grids.add(row.profileLocation.locationGrid)
    row.weatherLocationsMixed = grids.size > 1
    for (const event of allEvents) {
      const grid = event.location && event.location.locationGrid
      event.historicalWeather = grid ? weatherCache.get(`${grid}|${row.targetDate}`) || null : null
    }
    for (const attack of row.diaryOutcome.attacks) {
      for (const medication of attack.linkedMedications) {
        const medGrid = medication.location && medication.location.locationGrid
        medication.historicalWeather = medGrid ? weatherCache.get(`${medGrid}|${medication.date}`) || null : null
      }
    }
    const grid = grids.size === 1 ? [...grids][0] : null
    row.eventLocationGrid = grid
    row.historicalWeather = grid ? weatherCache.get(`${grid}|${row.targetDate}`) || null : null
    row.weatherFeatureSources = {}
    for (const field of ['pressureMmHg', 'pressureDelta24hMmHg', 'humidity', 'humidityDelta24h', 'tempMin', 'tempMax', 'windKmhMax']) {
      row.weatherFeatureSources[field] = row.features[field] == null ? null : 'SAVED_SNAPSHOT'
      if (row.features[field] == null && row.historicalWeather && row.historicalWeather.features[field] != null) {
        row.features[field] = row.historicalWeather.features[field]
        row.weatherFeatureSources[field] = 'HISTORICAL_ARCHIVE'
      }
    }
    if (Object.values(row.weatherFeatureSources).includes('HISTORICAL_ARCHIVE')) row.trainingEligible = false
    if (row.weatherLocationsMixed || (grid && row.locationGrid && grid !== row.locationGrid)) row.trainingEligible = false
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
    coverageVersion: 'all-diary-days-v1',
    historicalWeatherRequests: weatherRequests, historicalWeatherFailures: weatherFailures,
    historicalWeatherPendingGroups: Math.max(0, requests.size - weatherRequests),
    trainingEligibleCount: examples.filter(row => row.trainingEligible).length,
    incompleteInputCount: examples.filter(row => !row.trainingEligible).length,
    participantCount: includedParticipants.size,
    outcomeDays: { attackPresent: examples.filter(e => e.outcome === 1).length,
      noAttack: examples.filter(e => e.outcome === 0).length },
  }, { upsert: true })

  // Publish the completed generation first; remove rows and offline artifacts built from old data.
  training.training_examples.deleteMany({ generation: { $ne: generation } })
  // Remove the superseded derived copy after the unified dataset is published.
  training.diary_events.deleteMany({})
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
