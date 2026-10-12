// Offline-only evaluation against one exported generation. Never changes the live predictor.
(() => {
  const testMode = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  const expectedDatabase = testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const sourceName = testMode ? 'calm_risk_pipeline_test_source' : 'calm'
  const featureSchemaVersion = 2
  const scoringVersion = 'personal-rules-v1'
  const consentVersion = process.env.CALM_RISK_CONSENT_VERSION ||
    (testMode ? 'shared-model-pilot-v1' : '')
  const consentDigest = process.env.CALM_RISK_CONSENT_DIGEST || (testMode ? 'a'.repeat(64) : '')
  const modelVersion = 'shared-logistic-v2'
  const featureNames = [
    'weatherScore', 'pressureHpa', 'pressureDelta24h', 'humidity', 'tempMin', 'tempMax',
    'windKmhMax', 'kpIndex', 'attacksLast3Days', 'attacksLast7Days',
    'medicationDaysLast7Days', 'overuseRisk', 'historyDays', 'historyAttackDays',
    'attackStartsLast14Days', 'attackStartsLast30Days',
    'meanAttackIntensityLast30Days', 'daysSinceLastAttackStart',
  ]
  const minimums = {
    participants: 3,
    examples: 100,
    attackDays: 20,
    noAttackDays: 20,
    holdoutParticipants: 1,
    holdoutAttackDays: 5,
    holdoutNoAttackDays: 5,
    trainingAttackDays: 10,
    trainingNoAttackDays: 10,
  }

  if (db.getName() !== expectedDatabase) throw new Error(`Connect to '${expectedDatabase}' only`)
  const metadata = db.export_metadata.findOne({ _id: 'active' })
  if (!metadata?.generation) throw new Error('No published training generation')
  if (!consentVersion || !/^[a-f0-9]{64}$/.test(consentDigest) ||
      metadata.consentVersion !== consentVersion || metadata.consentDigest !== consentDigest ||
      metadata.featureSchemaVersion !== featureSchemaVersion ||
      metadata.scoringVersion !== scoringVersion) {
    throw new Error('Training snapshot policy or feature version is incompatible; rebuild before evaluation')
  }
  const ageMs = Date.now() - new Date(metadata.generatedAt).getTime()
  if (!Number.isFinite(ageMs) || ageMs < -60_000 || ageMs > 15 * 60_000) {
    throw new Error('Training snapshot is stale; rebuild before evaluation')
  }
  const sourceUri = process.env.CALM_TRAINING_SOURCE_URI
  const pseudonymKey = process.env.CALM_TRAINING_HMAC_KEY
  if (typeof sourceUri !== 'string' || !sourceUri.split('?')[0].endsWith(`/${sourceName}`) ||
      !pseudonymKey || Buffer.byteLength(pseudonymKey, 'utf8') < 32) {
    throw new Error('Set read-only CALM_TRAINING_SOURCE_URI and stable CALM_TRAINING_HMAC_KEY')
  }
  const source = new Mongo(sourceUri).getDB(sourceName)
  if (!testMode) {
    const currentPolicy = source.risk_model_consent_policy.findOne({ _id: 'current' })
    if (!currentPolicy || currentPolicy.version !== consentVersion || currentPolicy.digest !== consentDigest) {
      throw new Error('Configured consent version or digest does not match the current backend policy')
    }
  }
  const crypto = require('crypto')
  const activeConsentQuery = { participating: true, consentVersion }
  if (!testMode) activeConsentQuery.consentDigest = consentDigest
  const activeKeys = new Set(source.risk_model_participation.find(activeConsentQuery)
    .toArray().filter(row => typeof row.userId === 'string' && row.userId.length > 0)
    .map(row => crypto.createHmac('sha256', pseudonymKey).update(row.userId).digest('hex')))
  const examples = db.training_examples.find({ generation: metadata.generation }).toArray()
  if (examples.some(row => !activeKeys.has(row.participantKey))) {
    throw new Error('Training snapshot includes withdrawn or deleted participants; rebuild before evaluation')
  }
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}_${crypto.randomBytes(8).toString('hex')}`

  const counts = rows => ({
    examples: rows.length,
    attackDays: rows.filter(row => row.outcome === 1).length,
    noAttackDays: rows.filter(row => row.outcome === 0).length,
    participants: new Set(rows.map(row => row.participantKey)).size,
  })
  const overall = counts(examples)
  const reasons = []
  const expectedFeatureSet = new Set(featureNames)
  const seenParticipantDays = new Set()
  let invalidExamples = 0
  for (const row of examples) {
    const rowDayKey = `${row.participantKey}\u001f${row.targetDate}`
    const rowFeatureKeys = new Set(Object.keys(row.features ?? {}))
    const featureShapeValid = rowFeatureKeys.size === expectedFeatureSet.size &&
      [...expectedFeatureSet].every(name => rowFeatureKeys.has(name)) &&
      featureNames.every(name => name === 'overuseRisk'
        ? typeof row.features[name] === 'boolean'
        : row.features[name] == null || Number.isFinite(Number(row.features[name])))
    const valid = typeof row.participantKey === 'string' && /^[a-f0-9]{64}$/.test(row.participantKey) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.targetDate) && (row.outcome === 0 || row.outcome === 1) &&
      Number.isInteger(row.baselineScore) && row.baselineScore >= 0 && row.baselineScore <= 100 &&
      row.featureSchemaVersion === featureSchemaVersion && row.scoringVersion === scoringVersion && featureShapeValid &&
      !seenParticipantDays.has(rowDayKey)
    if (!valid) invalidExamples++
    seenParticipantDays.add(rowDayKey)
  }
  if (invalidExamples > 0) reasons.push(`invalid or duplicate examples: ${invalidExamples}`)
  if (overall.participants < minimums.participants) reasons.push(`participants < ${minimums.participants}`)
  if (overall.examples < minimums.examples) reasons.push(`labeled days < ${minimums.examples}`)
  if (overall.attackDays < minimums.attackDays) reasons.push(`attack days < ${minimums.attackDays}`)
  if (overall.noAttackDays < minimums.noAttackDays) reasons.push(`no-attack days < ${minimums.noAttackDays}`)

  const evaluation = {
    _id: runId,
    generatedAt: new Date(),
    generation: metadata.generation,
    featureSchemaVersion,
    modelVersion,
    status: 'INSUFFICIENT_DATA',
    minimums,
    overall,
    reasons,
    splitMethod: 'deterministic participant holdout, 20 percent by keyed participant order',
    liveModelChanged: false,
  }

  if (reasons.length === 0) {
    const participantHashes = [...new Set(examples.map(row => row.participantKey))]
      .map(key => ({ key, hash: crypto.createHash('sha256').update(key).digest('hex') }))
      .sort((a, b) => a.hash.localeCompare(b.hash))
    const holdoutSize = Math.max(minimums.holdoutParticipants, Math.ceil(participantHashes.length * 0.2))
    const holdoutKeys = new Set(participantHashes.slice(0, holdoutSize).map(item => item.key))
    const trainRows = examples.filter(row => !holdoutKeys.has(row.participantKey))
    const holdoutRows = examples.filter(row => holdoutKeys.has(row.participantKey))
    const training = counts(trainRows)
    const holdout = counts(holdoutRows)
    evaluation.training = training
    evaluation.holdout = holdout

    if (holdout.participants < minimums.holdoutParticipants) reasons.push('not enough held-out participants')
    if (holdout.attackDays < minimums.holdoutAttackDays) reasons.push('not enough held-out attack days')
    if (holdout.noAttackDays < minimums.holdoutNoAttackDays) reasons.push('not enough held-out no-attack days')
    if (training.attackDays < minimums.trainingAttackDays || training.noAttackDays < minimums.trainingNoAttackDays) {
		reasons.push(`training split needs at least ${minimums.trainingAttackDays} examples of each outcome`)
	}

    const classWeights = rows => {
      const totalDays = new Map()
      for (const row of rows) totalDays.set(row.participantKey, (totalDays.get(row.participantKey) ?? 0) + 1)
      return rows.map(row => 1 / totalDays.get(row.participantKey))
    }
    const finiteFeature = (row, name) => {
      const raw = row.features?.[name]
      if (raw == null) return null
      const value = name === 'overuseRisk' ? (raw ? 1 : 0) : Number(raw)
      return Number.isFinite(value) ? value : null
    }
    const weightedMean = (values, weights) => {
      let sum = 0, mass = 0
      for (let i = 0; i < values.length; i++) {
        if (values[i] == null) continue
        sum += values[i] * weights[i]
        mass += weights[i]
      }
      return mass === 0 ? 0 : sum / mass
    }
    const trainWeights = classWeights(trainRows)
    const means = featureNames.map(name => weightedMean(trainRows.map(row => finiteFeature(row, name)), trainWeights))
    const scales = featureNames.map((name, column) => {
      let variance = 0, mass = 0
      for (let i = 0; i < trainRows.length; i++) {
        const value = finiteFeature(trainRows[i], name)
        if (value == null) continue
        variance += trainWeights[i] * (value - means[column]) ** 2
        mass += trainWeights[i]
      }
      const sd = mass === 0 ? 0 : Math.sqrt(variance / mass)
      return sd > 1e-9 ? sd : 1
    })
    const vector = row => featureNames.map((name, i) => {
      const raw = finiteFeature(row, name)
      return ((raw == null ? means[i] : raw) - means[i]) / scales[i]
    })
    const trainX = trainRows.map(vector)
    const trainY = trainRows.map(row => row.outcome)
    const trainWeightSum = trainWeights.reduce((sum, weight) => sum + weight, 0)
    const weights = featureNames.map(() => 0)
    const weightedPositiveMass = trainRows.reduce((sum, row, i) => sum + trainWeights[i] * row.outcome, 0)
    const weightedNegativeMass = trainWeightSum - weightedPositiveMass
    let intercept = Math.log((weightedPositiveMass + 1) / (weightedNegativeMass + 1))
    const sigmoid = value => value < -30 ? 0 : value > 30 ? 1 : 1 / (1 + Math.exp(-value))

    for (let epoch = 0; epoch < 2500; epoch++) {
      const gradient = weights.map(() => 0)
      let biasGradient = 0
      for (let i = 0; i < trainX.length; i++) {
        let linear = intercept
        for (let j = 0; j < weights.length; j++) linear += weights[j] * trainX[i][j]
        const error = (sigmoid(linear) - trainY[i]) * trainWeights[i]
        biasGradient += error
        for (let j = 0; j < weights.length; j++) gradient[j] += error * trainX[i][j]
      }
      const learningRate = 0.08 / trainWeightSum
      intercept -= learningRate * biasGradient
      for (let j = 0; j < weights.length; j++) {
        weights[j] -= learningRate * (gradient[j] + 0.02 * weights[j])
      }
    }

    const probabilities = rows => rows.map(row => {
      const x = vector(row)
      return sigmoid(intercept + weights.reduce((sum, weight, i) => sum + weight * x[i], 0))
    })
    const weightedAuc = (rows, scores) => {
      const rowWeights = classWeights(rows)
      const pairs = rows.map((row, i) => ({ score: scores[i], y: row.outcome, weight: rowWeights[i] }))
        .sort((a, b) => a.score - b.score)
      const positiveMass = pairs.filter(pair => pair.y === 1).reduce((sum, pair) => sum + pair.weight, 0)
      const negativeMass = pairs.filter(pair => pair.y === 0).reduce((sum, pair) => sum + pair.weight, 0)
      let previousNegativeMass = 0, concordance = 0
      for (let i = 0; i < pairs.length;) {
        let j = i + 1, groupPositive = pairs[i].y ? pairs[i].weight : 0
        let groupNegative = pairs[i].y ? 0 : pairs[i].weight
        while (j < pairs.length && pairs[j].score === pairs[i].score) {
          if (pairs[j].y) groupPositive += pairs[j].weight
          else groupNegative += pairs[j].weight
          j++
        }
        concordance += groupPositive * (previousNegativeMass + groupNegative / 2)
        previousNegativeMass += groupNegative
        i = j
      }
      return positiveMass && negativeMass ? concordance / (positiveMass * negativeMass) : null
    }
    const weightedBrier = (rows, scores) => {
      const rowWeights = classWeights(rows)
      const mass = rowWeights.reduce((sum, weight) => sum + weight, 0)
      return rows.reduce((sum, row, i) => sum + rowWeights[i] * (scores[i] - row.outcome) ** 2, 0) / mass
    }
    const weightedConfusion = (rows, scores, threshold, scoreOf) => {
      const rowWeights = classWeights(rows)
      const result = { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 }
      rows.forEach((row, i) => {
        const alert = scoreOf(row, scores[i]) >= threshold
        if (row.outcome === 1 && alert) result.truePositive += rowWeights[i]
        else if (row.outcome === 1) result.falseNegative += rowWeights[i]
        else if (alert) result.falsePositive += rowWeights[i]
        else result.trueNegative += rowWeights[i]
      })
      return result
    }
    const rates = confusion => {
      const sensitivityDenominator = confusion.truePositive + confusion.falseNegative
      const specificityDenominator = confusion.trueNegative + confusion.falsePositive
      const precisionDenominator = confusion.truePositive + confusion.falsePositive
      const sensitivity = sensitivityDenominator ? confusion.truePositive / sensitivityDenominator : null
      const specificity = specificityDenominator ? confusion.trueNegative / specificityDenominator : null
      return {
        sensitivity,
        specificity,
        precision: precisionDenominator ? confusion.truePositive / precisionDenominator : null,
        falsePositiveRate: specificity == null ? null : 1 - specificity,
        balancedAccuracy: sensitivity == null || specificity == null ? null : (sensitivity + specificity) / 2,
      }
    }

    if (reasons.length === 0) {
      const probabilitiesOnHoldout = probabilities(holdoutRows)
      const ruleScores = holdoutRows.map(row => Number(row.baselineScore) / 100)
      const trainPrevalence = weightedPositiveMass / trainWeightSum
      const constantBaseline = holdoutRows.map(() => trainPrevalence)
      const modelAuc = weightedAuc(holdoutRows, probabilitiesOnHoldout)
      const ruleAuc = weightedAuc(holdoutRows, ruleScores)
      const modelBrier = weightedBrier(holdoutRows, probabilitiesOnHoldout)
      const baseRateBrier = weightedBrier(holdoutRows, constantBaseline)
      const ruleConfusion = weightedConfusion(holdoutRows, ruleScores, 0.35, (_row, score) => score)
      const modelConfusion = weightedConfusion(holdoutRows, probabilitiesOnHoldout, 0.5, (_row, score) => score)
      evaluation.status = 'EVALUATED_OFFLINE_ONLY'
      evaluation.metrics = {
        participantWeighted: true,
        modelRocAuc: modelAuc,
        ruleScoreRocAuc: ruleAuc,
        modelBrierScore: modelBrier,
        trainPrevalenceBrierScore: baseRateBrier,
        modelAtThreshold05: modelConfusion,
        modelRatesAtThreshold05: rates(modelConfusion),
        currentRuleAt35Points: ruleConfusion,
        currentRuleRatesAt35Points: rates(ruleConfusion),
        candidateWorthHumanReview: modelAuc != null && ruleAuc != null && modelBrier < baseRateBrier && modelAuc > ruleAuc,
      }
      evaluation.candidateId = `candidate_${runId}`
      db.risk_model_candidates.insertOne({
        _id: evaluation.candidateId,
        status: 'OFFLINE_ONLY_NEVER_AUTO_ACTIVATE',
        modelVersion,
        generation: metadata.generation,
        featureSchemaVersion,
        featureNames,
        imputationMeans: means,
        scales,
        weights,
        intercept,
        createdAt: evaluation.generatedAt,
      })
    }
  }

  db.risk_model_evaluations.insertOne(evaluation)
  printjson({ status: evaluation.status, overall: evaluation.overall,
    training: evaluation.training ?? null, holdout: evaluation.holdout ?? null,
    metrics: evaluation.metrics ?? null, reasons: evaluation.reasons,
    liveModelChanged: false })
})()
