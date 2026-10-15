// Run with mongosh against calm_risk_training. Prints only the active,
// pseudonymized training snapshot as CSV; account identifiers are never exported.
(() => {
  const metadata = db.export_metadata.findOne({ _id: 'active' })
  const featureNames = [
    'weatherScore', 'pressureHpa', 'pressureDelta24h', 'humidity',
    'tempMin', 'tempMax', 'windKmhMax', 'kpIndex',
    'attacksLast3Days', 'attacksLast7Days', 'medicationDaysLast7Days',
    'overuseRisk', 'historyDays', 'historyAttackDays',
    'attackStartsLast14Days', 'attackStartsLast30Days',
    'meanAttackIntensityLast30Days', 'daysSinceLastAttackStart',
  ]
  const columns = [
    'participantKey', 'targetDate', 'outcome', 'baselineScore', 'baselineLevel',
    ...featureNames,
  ]
  const csv = value => {
    if (value === null || value === undefined) return ''
    const text = String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  print(columns.map(csv).join(','))
  if (!metadata || typeof metadata.generation !== 'string') return

  db.training_examples.find({ generation: metadata.generation }, {
    _id: 0,
    participantKey: 1,
    targetDate: 1,
    outcome: 1,
    baselineScore: 1,
    baselineLevel: 1,
    features: 1,
  }).sort({ targetDate: 1, participantKey: 1 }).forEach(example => {
    const row = [
      example.participantKey,
      example.targetDate,
      example.outcome,
      example.baselineScore,
      example.baselineLevel,
      ...featureNames.map(name => example.features?.[name]),
    ]
    print(row.map(csv).join(','))
  })
})()
