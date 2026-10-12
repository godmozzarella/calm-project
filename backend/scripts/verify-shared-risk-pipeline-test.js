// Read-only assertions against the fixed synthetic source and destination databases.
(() => {
  const sourceName = 'calm_risk_pipeline_test_source'
  const trainingName = 'calm_risk_pipeline_test_training'
  if (db.getName() !== sourceName) throw new Error(`Connect to ${sourceName}`)
  const trainingUri = process.env.CALM_TRAINING_MONGO_URI
  const key = process.env.CALM_TRAINING_HMAC_KEY
  const revoked = process.env.CALM_RISK_PIPELINE_TEST_REVOKED === 'YES'
  if (typeof trainingUri !== 'string' || !trainingUri.split('?')[0].endsWith(`/${trainingName}`)) {
    throw new Error('Wrong test destination URI')
  }
  if (!key || Buffer.byteLength(key, 'utf8') < 32) throw new Error('Missing test HMAC key')

  const training = new Mongo(trainingUri).getDB(trainingName)
  const metadata = training.export_metadata.findOne({ _id: 'active' })
  if (!metadata?.generation) throw new Error('No published generation')
  const expectedParticipants = revoked ? 29 : 30
  const expectedExamples = expectedParticipants * 10
  const examples = training.training_examples.find({ generation: metadata.generation }).toArray()
  if (metadata.participantCount !== expectedParticipants || metadata.exampleCount !== expectedExamples ||
      examples.length !== expectedExamples) {
    throw new Error(`Unexpected export size: ${metadata.participantCount} participants, ${examples.length} rows`)
  }
  if (training.training_examples.countDocuments({ generation: { $ne: metadata.generation } }) !== 0) {
    throw new Error('Stale generation still exists')
  }
  if (training.risk_model_candidates.countDocuments({ generation: { $ne: metadata.generation } }) !== 0 ||
      training.risk_model_evaluations.countDocuments({ generation: { $ne: metadata.generation } }) !== 0) {
    throw new Error('Stale offline model artifacts still exist')
  }

  const crypto = require('crypto')
  const withdrawnKey = crypto.createHmac('sha256', key).update('pipeline-test-user-0').digest('hex')
  const withdrawalRows = examples.filter(row => row.participantKey === withdrawnKey)
  if (withdrawalRows.length !== (revoked ? 0 : 10)) throw new Error('Withdrawal filter failed')
  if (examples.some(row => 'userId' in row || 'email' in row || 'note' in row || !row.features)) {
    throw new Error('Unexpected personal fields in training records')
  }
  if (examples.filter(row => row.outcome === 1).length !== expectedParticipants * 3) {
    throw new Error('Positive labels differ from synthetic attacks')
  }
  if (examples.filter(row => row.outcome === 0).length !== expectedParticipants * 7) {
    throw new Error('Negative labels differ from confirmations')
  }
  print(`Verified ${trainingName}: ${expectedParticipants} pseudonymous people, ${expectedExamples} labeled days, revoked=${revoked}`)
})()
