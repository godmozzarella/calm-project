// Fixed credentials and database names for the isolated, disposable Compose test only.
(() => {
  if (db.getName() !== 'admin') throw new Error('Connect to admin in isolated auth test')
  const users = [
    { user: 'risk_test_source_reader', pwd: 'risk-test-source-only-password',
      roles: [{ role: 'read', db: 'calm_risk_pipeline_test_source' }] },
    { user: 'risk_test_training_writer', pwd: 'risk-test-training-only-password',
      roles: [{ role: 'readWrite', db: 'calm_risk_pipeline_test_training' }] },
  ]
  for (const account of users) {
    if (db.getUser(account.user)) db.updateUser(account.user, { pwd: account.pwd, roles: account.roles })
    else db.createUser(account)
  }
  print('Created source-read and training-write accounts for isolated test databases')
})()
