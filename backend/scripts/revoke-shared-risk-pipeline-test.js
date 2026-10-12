// Simulate withdrawal for exactly one synthetic participant.
(() => {
  const expectedDatabase = 'calm_risk_pipeline_test_source'
  if (db.getName() !== expectedDatabase) throw new Error(`Connect to ${expectedDatabase}`)
  const result = db.risk_model_participation.updateOne(
    { _id: 'pipeline-test-participation-0', userId: 'pipeline-test-user-0' },
    { $set: { participating: false, updatedAt: new Date() } },
  )
  if (result.matchedCount !== 1) throw new Error('Synthetic participant missing')
  print('Synthetic participant 0 withdrew')
})()
