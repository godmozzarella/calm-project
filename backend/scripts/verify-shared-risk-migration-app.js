// Authenticate as app after enabling --auth; verify only application DB access.
(() => {
  if (db.getName() !== 'calm_risk_pipeline_test_source') throw new Error('Wrong migration test DB')
  if (db.risk_model_participation.countDocuments({}) !== 31) throw new Error('App cannot read source')
  const policy = db.risk_model_consent_policy.findOne({ _id: 'current' })
  if (!policy || policy.version !== 'shared-model-pilot-v1' || policy.digest !== 'a'.repeat(64)) {
    throw new Error('App cannot read the current consent policy')
  }
  db.risk_migration_write_check.insertOne({ _id: 'temporary' })
  db.risk_migration_write_check.deleteOne({ _id: 'temporary' })
  try {
    db.getSiblingDB('calm_risk_pipeline_test_training').export_metadata.findOne({ _id: 'active' })
  } catch (error) {
    if (error.code === 13 || error.codeName === 'Unauthorized') {
      print('Verified application read/write access and training DB isolation after --auth')
      return
    }
    throw error
  }
  throw new Error('Application account unexpectedly reads training DB')
})()
