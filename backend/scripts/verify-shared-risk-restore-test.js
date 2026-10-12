// Compare the disposable source database with its restored copy, including BSON values.
(() => {
  const sourceName = 'calm_risk_pipeline_test_source'
  const restoredName = 'calm_risk_pipeline_test_restored'
  if (db.getName() !== sourceName) throw new Error(`Connect to ${sourceName}`)
  const restored = db.getSiblingDB(restoredName)
  const crypto = require('crypto')
  const names = ['risk_model_participation', 'risk_prediction_records', 'risk_daily_outcomes',
    'attacks', 'risk_model_consent_policy']
  for (const name of names) {
    const digest = database => crypto.createHash('sha256')
      .update(EJSON.stringify(database.getCollection(name).find({}).sort({ _id: 1 }).toArray()))
      .digest('hex')
    const originalCount = db.getCollection(name).countDocuments({})
    const restoredCount = restored.getCollection(name).countDocuments({})
    if (originalCount === 0 || originalCount !== restoredCount || digest(db) !== digest(restored)) {
      throw new Error(`Backup restore mismatch in ${name}`)
    }
  }
  print('Verified synthetic backup restore: five collections match exactly')
})()
