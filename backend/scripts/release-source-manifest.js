// Compare before/after the additive location migration while application writers are stopped.
// Prints only counts and hashes; never prints diary records or account identifiers.
(() => {
  const expected = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
    ? 'calm_risk_pipeline_test_source' : 'calm'
  if (db.getName() !== expected) throw new Error('Wrong release source database')
  const crypto = require('crypto')
  const result = {}
  for (const name of ['users', 'attacks', 'medications', 'personal_medications']) {
    const rows = db.getCollection(name).find({}, { eventLocation: 0 }).sort({ _id: 1 }).toArray()
    result[name] = {
      count: rows.length,
      sha256: crypto.createHash('sha256').update(EJSON.stringify(rows, { relaxed: false })).digest('hex'),
    }
  }
  print(JSON.stringify(result))
})()
