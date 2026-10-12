// Verify actual MongoDB authorization with either of the fixed isolated test accounts.
(() => {
  const sourceName = 'calm_risk_pipeline_test_source'
  const trainingName = 'calm_risk_pipeline_test_training'
  const account = process.env.CALM_RISK_AUTH_TEST_ACCOUNT
  const expectedName = account === 'source' ? sourceName : trainingName
  if (!['source', 'training'].includes(account) || db.getName() !== expectedName) {
    throw new Error('Connect to the matching isolated test database and set account=source or training')
  }

  const forbidden = action => {
    try { action() } catch (error) {
      if (error.code === 13 || error.codeName === 'Unauthorized') return
      throw error
    }
    throw new Error('Unexpected database permission: forbidden operation succeeded')
  }

  if (account === 'source') {
    if (db.risk_model_participation.countDocuments({}) !== 31) throw new Error('Source read failed')
    forbidden(() => db.risk_auth_test_write.insertOne({ _id: 'must-not-exist' }))
    forbidden(() => db.getSiblingDB(trainingName).export_metadata.findOne({ _id: 'active' }))
  } else {
    db.risk_auth_test_write.insertOne({ _id: 'temporary' })
    db.risk_auth_test_write.deleteOne({ _id: 'temporary' })
    forbidden(() => db.getSiblingDB(sourceName).risk_model_participation.findOne({}))
  }
  print(`Verified ${account} account has only the intended test database access`)
})()
