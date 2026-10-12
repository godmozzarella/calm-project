// Run as test root against restored source DB after both recovery steps.
(() => {
  if (db.getName() !== 'calm_risk_pipeline_test_restored') {
    throw new Error('Connect to the isolated restored source DB')
  }
  if (db.risk_model_participation.countDocuments({ participating: true }) !== 0) {
    throw new Error('Restored consent was reactivated')
  }
  if (db.risk_model_participation.countDocuments({ 'events.action': 'RESTORE_RECONSENT_REQUIRED' }) !== 30) {
    throw new Error('Recovery consent events missing')
  }
  const policy = db.risk_model_consent_policy.findOne({ _id: 'current' })
  if (!policy || policy.version !== 'shared-model-pilot-v1' ||
      typeof policy.digest !== 'string' || !/^[a-f0-9]{64}$/.test(policy.digest)) {
    throw new Error('Current consent policy is missing or invalid after restore recovery')
  }
  const training = db.getSiblingDB('calm_risk_pipeline_test_training')
  for (const name of ['training_examples', 'risk_model_candidates', 'risk_model_evaluations', 'export_metadata']) {
    if (training.getCollection(name).countDocuments({}) !== 0) {
      throw new Error(`Old training data remains in ${name}`)
    }
  }
  print('Verified restore recovery: consents reset, current policy preserved, no old training artifacts')
})()
