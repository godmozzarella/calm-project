// Create roles before enabling --auth on an existing MongoDB volume.
(() => {
  if (db.getName() !== 'admin') throw new Error('Connect to admin to create MongoDB users')
  if (process.env.CALM_MONGO_SETUP_CONFIRM !== 'YES') {
    throw new Error('Set CALM_MONGO_SETUP_CONFIRM=YES after verifying a backup and downtime window')
  }

  const testMode = process.env.CALM_MONGO_SETUP_TEST_MODE === 'YES'
  const sourceName = testMode ? 'calm_risk_pipeline_test_source' : 'calm'
  const trainingName = testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const accounts = [
    { user: 'calm_risk_admin', password: process.env.CALM_MONGO_ROOT_PASSWORD, roles: ['root'] },
    { user: 'calm_app', password: process.env.CALM_MONGO_APP_PASSWORD,
      roles: [{ role: 'readWrite', db: sourceName }] },
    { user: 'calm_risk_export_reader', password: process.env.CALM_MONGO_EXPORT_PASSWORD,
      roles: [{ role: 'read', db: sourceName }] },
    { user: 'calm_risk_training_writer', password: process.env.CALM_MONGO_TRAINING_PASSWORD,
      roles: [{ role: 'readWrite', db: trainingName }] },
  ]
  const passwords = accounts.map(account => account.password)
  if (passwords.some(password => typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 32)) {
    throw new Error('Provide four distinct MongoDB passwords of at least 32 bytes')
  }
  if (new Set(passwords).size !== passwords.length) {
    throw new Error('MongoDB account passwords must be distinct')
  }
  const existing = accounts.filter(account => db.getUser(account.user)).map(account => account.user)
  if (existing.length) throw new Error(`Users already exist: ${existing.join(', ')}; inspect before retrying`)

  for (const account of accounts) {
    db.createUser({ user: account.user, pwd: account.password, roles: account.roles })
  }
  print(`Created four MongoDB users for '${sourceName}' and '${trainingName}'`)
})()
