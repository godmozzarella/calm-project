// Idempotent primary-data migration. Run only after a backup with the application write URI.
(() => {
  const testMode = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  if (db.getName() !== (testMode ? 'calm_risk_pipeline_test_source' : 'calm')) throw new Error('Wrong source database')
  let updated = 0
  for (const user of db.users.find({ latitude: { $ne: null }, longitude: { $ne: null } }).toArray()) {
    if (typeof user.latitude !== 'number' || typeof user.longitude !== 'number') continue
    const location = { latitude: user.latitude, longitude: user.longitude, city: user.city || null,
      timezone: user.locationTimezone || 'UTC', mode: user.locationMode === 'AUTO' ? 'AUTO' : 'MANUAL',
      source: 'LEGACY_PROFILE_ASSUMPTION', capturedAt: new Date() }
    for (const name of ['attacks', 'medications']) {
      const result = db.getCollection(name).updateMany({ userId: String(user._id), eventLocation: null }, { $set: { eventLocation: location } })
      updated += result.modifiedCount
    }
  }
  print(`Backfilled event locations: ${updated}`)
})()
