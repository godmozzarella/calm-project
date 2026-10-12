// Verify the training effect and source cleanup before/after API account deletion.
(() => {
  if (db.getName() !== 'calm_risk_pipeline_test_source') throw new Error('Wrong test source DB')
  const userId = process.env.CALM_RISK_DELETE_TEST_USER_ID
  const userMongoId = /^[a-f0-9]{24}$/.test(userId || '') ? ObjectId(userId) : userId
  const stage = process.env.CALM_RISK_DELETE_TEST_STAGE
  const key = process.env.CALM_TRAINING_HMAC_KEY
  if (!userId || !['before', 'after'].includes(stage) || !key) throw new Error('Missing test parameters')
  const participantKey = require('crypto').createHmac('sha256', key).update(userId).digest('hex')
  const training = db.getSiblingDB('calm_risk_pipeline_test_training')
  const metadata = training.export_metadata.findOne({ _id: 'active' })
  if (!metadata || !metadata.generation) throw new Error('No active training generation')
  const rowCount = training.training_examples.countDocuments({ generation: metadata.generation })
  const ownRows = training.training_examples.countDocuments({ generation: metadata.generation, participantKey })
  if (stage === 'before') {
    if (rowCount !== 301 || ownRows !== 1) throw new Error('Test account not included before deletion')
    print('Verified test account is present in the pre-deletion training snapshot')
    return
  }

  if (rowCount !== 300 || ownRows !== 0) throw new Error('Deleted account still in training snapshot')
  for (const name of ['users', 'auth_sessions', 'attacks', 'medications',
    'risk_prediction_records', 'risk_daily_outcomes', 'risk_model_participation']) {
    if (db.getCollection(name).countDocuments(name === 'users' ? { _id: userMongoId } : { userId }) !== 0) {
      throw new Error(`Deleted account still has records in ${name}`)
    }
  }
  if (db.risk_model_participation.countDocuments({}) !== 31) {
    throw new Error('Fixture participants were affected by account deletion')
  }
  print('Verified account deletion removed source records and rebuilt training row')
})()
