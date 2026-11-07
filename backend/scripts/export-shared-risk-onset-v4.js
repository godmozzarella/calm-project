// mongosh against calm. Separate v4 collections: never reinterpret a v3 pain-presence dataset.
(() => {
  const test = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  const sourceName = test ? 'calm_risk_pipeline_test_source' : 'calm'
  const targetName = test ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const uri = process.env.CALM_TRAINING_MONGO_URI
  const secret = process.env.CALM_TRAINING_HMAC_KEY
  if (db.getName() !== sourceName || !uri?.split('?')[0].endsWith(`/${targetName}`) ||
      !secret || Buffer.byteLength(secret, 'utf8') < 32 || process.env.CALM_TRAINING_REBUILD_CONFIRM !== 'YES') {
    throw new Error('Invalid onset export configuration')
  }
  const policy = db.risk_model_consent_policy.findOne({ _id: 'current' })
  if (!policy || policy.version !== process.env.CALM_RISK_CONSENT_VERSION ||
      policy.digest !== process.env.CALM_RISK_CONSENT_DIGEST) throw new Error('Consent policy mismatch')
  const crypto = require('crypto')
  const hmac = value => crypto.createHmac('sha256', secret).update(value, 'utf8').digest('hex')
  const dayKey = value => value instanceof Date ? value.toISOString().slice(0, 10) : value
  const accountIds = new Set(db.users.find({}, { _id: 1 }).toArray().map(u => String(u._id)))
  const ids = db.risk_model_participation.find({ participating: true, adminBlocked: { $ne: true },
    consentVersion: policy.version, consentDigest: policy.digest }).toArray()
    .map(p => p.userId).filter(id => accountIds.has(id))
  const labelByDay = new Map(db.risk_onset_daily_labels.find({ userId: { $in: ids } }).toArray()
    .map(label => [`${label.userId}|${dayKey(label.targetDate)}`, label]))
  const clean = value => {
    if (value instanceof Date || value == null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(clean)
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== '_class').map(([k, v]) => [k, clean(v)]))
  }
  const pick = (obj, keys) => Object.fromEntries(keys.map(k => [k, clean(obj?.[k] ?? null)]))
  const featureNames = ['episodeStartsLast3Days', 'episodeStartsLast7Days', 'episodeStartsLast14Days',
    'episodeStartsLast30Days', 'episodeStartsLast90Days', 'medicationDaysLast7Days',
    'observedNoNewStartDaysLast30Days', 'daysSinceLastAttackStart', 'meanAttackIntensityLast30Days',
    'ongoingAtIssue', 'historyDetails']
  const weatherNames = ['provider', 'fetchedAt', 'stale', 'locationGrid', 'pressureMmHg',
    'pressureDelta24hMmHg', 'humidity', 'humidityDelta24h', 'tempMin', 'tempMax', 'windKmhMax', 'kpIndex', 'forecastTimezone']
  const now = new Date()
  const generation = `${now.toISOString().replace(/[-:.TZ]/g, '')}_${crypto.randomBytes(8).toString('hex')}`
  const rows = []
  for (const input of db.risk_onset_input_snapshots.find({ userId: { $in: ids } }).toArray()) {
    if (input.featureSchemaVersion !== 4 || input.targetVersion !== 'new-attack-onset-local-day-v1' ||
        input.protocolVersion !== 'midnight-local-v1' || input.consentVersion !== policy.version ||
        input.consentDigest !== policy.digest) continue
    const day = dayKey(input.targetDate)
    const label = labelByDay.get(`${input.userId}|${day}`)
    const participantKey = hmac(input.userId)
    const flags = [...(input.qualityFlags || [])]
    const captured = new Date(input.capturedAt).getTime()
    const cutoff = new Date(input.plannedIssueAt).getTime()
    const end = new Date(input.targetEndAt).getTime()
    const featureUsable = input.featureUsable === true && Number.isFinite(captured) &&
      Number.isFinite(cutoff) && captured <= cutoff && captured >= cutoff - 60_000
    const labelUsable = Boolean(label && label.timezone === input.timezone &&
      label.dayCompleted && Number.isFinite(end) && now.getTime() >= end && (label.outcome === 0 || label.outcome === 1))
    if (!featureUsable) flags.push('INPUT_TIMING_INVALID')
    if (!labelUsable) flags.push('LABEL_UNKNOWN_OR_INCOMPLETE')
    rows.push({
      _id: `${generation}_${participantKey}_${day}`,
      generation, participantKey, targetDate: day, featureSchemaVersion: 4,
      outcomeDefinition: input.targetVersion, protocolVersion: input.protocolVersion,
      timezone: input.timezone, plannedIssueAt: input.plannedIssueAt, capturedAt: input.capturedAt,
      targetEndAt: input.targetEndAt, features: pick(input.features, featureNames), weatherForecast: pick(input.weatherForecast, weatherNames),
      outcome: label?.outcome ?? null, headachePresent: label?.headachePresent ?? null,
      dayCompleted: label?.dayCompleted ?? false,
      labelSource: label?.labelSource ?? 'UNKNOWN', markedAt: label?.markedAt ?? null,
      finalizedAt: label?.finalizedAt ?? null, labelAvailableAt: label?.labelAvailableAt ?? null,
      labelRevision: label?.revision ?? null,
      matchedAttackKeys: (label?.matchedAttackIds || []).map(id => hmac(`${input.userId}\u001fattack\u001f${id}`)),
      featureUsable, labelUsable, trainingEligible: featureUsable && labelUsable, qualityFlags: flags,
    })
  }
  const training = new Mongo(uri).getDB(targetName)
  if (rows.length) training.onset_training_examples.insertMany(rows, { ordered: false })
  if (training.onset_training_examples.countDocuments({ generation }) !== rows.length) {
    throw new Error('Onset staging generation is incomplete')
  }
  training.onset_export_metadata.replaceOne({ _id: 'active' }, { _id: 'active', generation, generatedAt: now,
    featureSchemaVersion: 4, outcomeDefinition: 'new-attack-onset-local-day-v1', protocolVersion: 'midnight-local-v1',
    consentVersion: policy.version, consentDigest: policy.digest, exampleCount: rows.length,
    participantCount: new Set(rows.map(r => r.participantKey)).size,
    trainingEligibleCount: rows.filter(r => r.trainingEligible).length,
    unknownOutcomeCount: rows.filter(r => r.outcome == null).length }, { upsert: true })
  training.onset_training_examples.deleteMany({ generation: { $ne: generation } })
  print(`Published ${rows.length} onset v4 inputs; ${rows.filter(r => r.trainingEligible).length} eligible`)
})()
