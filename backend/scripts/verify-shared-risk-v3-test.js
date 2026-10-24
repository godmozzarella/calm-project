(() => {
  if (db.getName() !== 'calm_risk_pipeline_test_source' ||
      process.env.CALM_RISK_TRAINING_TEST_MODE !== 'YES') throw new Error('Isolated test DB only')
  const training = new Mongo(process.env.CALM_TRAINING_MONGO_URI).getDB('calm_risk_pipeline_test_training')
  const metadata = training.export_metadata.findOne({ _id: 'active' })
  if (!metadata || metadata.featureSchemaVersion !== 3 || metadata.detailSchemaVersion !== 1 ||
      metadata.consentVersion !== 'shared-model-pilot-v2') throw new Error('Wrong version-3 metadata')
  const rows = training.training_examples.find({ generation: metadata.generation }).toArray()
  const revoked = process.env.CALM_RISK_PIPELINE_TEST_REVOKED === 'YES'
  if (revoked) {
    if (rows.length !== 0) throw new Error('Withdrawn participant remains in training rows')
    print('Verified version-3 withdrawal removed all rows')
    return
  }
  if (rows.length !== 3 || rows.filter(row => row.outcome === 1).length !== 2 ||
      rows.filter(row => row.outcome === 0).length !== 1) throw new Error('Wrong version-3 day labels')
  const endDay = rows.find(row => row.diaryOutcome.attacks.length && row.diaryOutcome.medications.length)
  if (!endDay || endDay.attackCount !== 1 ||
      endDay.diaryOutcome.medications[0].linkedAttackKey !== endDay.diaryOutcome.attacks[0].attackKey ||
      endDay.diaryOutcome.medications[0].effectiveness !== 3 ||
      endDay.locationGrid !== '55.8,37.6' ||
      endDay.historyDetails.symptomsLast30Days[0].code !== 'nausea' ||
      endDay.binaryPrediction !== null || endDay.predictionMatched !== null) {
    throw new Error('Version-3 details or linkage are wrong')
  }
  if (rows.some(row => 'userId' in row ||
      row.diaryOutcome.attacks.some(attack => 'note' in attack) ||
      row.diaryOutcome.medications.some(medication => 'note' in medication))) {
    throw new Error('Direct identifier or diary note leaked')
  }
  print('Verified version-3 export: start/end labels, quiet day, details, linkage and no notes')
})()
