// Recovery step: discard all training rows and offline models before source DB reopens.
(() => {
  const testMode = process.env.CALM_RISK_RESTORE_TEST_MODE === 'YES'
  const expectedDatabase = testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  if (db.getName() !== expectedDatabase) throw new Error(`Connect to training DB '${expectedDatabase}'`)
  if (process.env.CALM_RISK_RESTORE_RESET_CONFIRM !== 'YES') {
    throw new Error('Set CALM_RISK_RESTORE_RESET_CONFIRM=YES after restoring a backup')
  }

  const collections = ['training_examples', 'risk_model_candidates', 'risk_model_evaluations', 'export_metadata']
  for (const name of collections) db.getCollection(name).deleteMany({})
  for (const name of collections) {
    if (db.getCollection(name).countDocuments({}) !== 0) {
      throw new Error(`Recovery purge incomplete in ${name}`)
    }
  }
  print('Recovery purge complete: training rows, offline models and metadata removed')
})()
