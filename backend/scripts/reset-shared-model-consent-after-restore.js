// Recovery step: run on a restored source DB before reopening it to users.
(() => {
  const testMode = process.env.CALM_RISK_RESTORE_TEST_MODE === 'YES'
  const expectedDatabase = testMode ? 'calm_risk_pipeline_test_restored' : 'calm'
  if (db.getName() !== expectedDatabase) throw new Error(`Connect to restored source DB '${expectedDatabase}'`)
  if (process.env.CALM_RISK_RESTORE_RESET_CONFIRM !== 'YES') {
    throw new Error('Set CALM_RISK_RESTORE_RESET_CONFIRM=YES after restoring a backup')
  }

  const now = new Date()
  const active = db.risk_model_participation.find({ participating: true }).toArray()
  for (const participant of active) {
    db.risk_model_participation.updateOne(
      { _id: participant._id, participating: true },
      {
        $set: { participating: false, updatedAt: now },
        $push: { events: { action: 'RESTORE_RECONSENT_REQUIRED',
          consentVersion: participant.consentVersion, occurredAt: now } },
      },
    )
  }
  const remaining = db.risk_model_participation.countDocuments({ participating: true })
  if (remaining !== 0) throw new Error(`${remaining} active pilot consents remain after recovery reset`)
  print(`Recovery reset complete: ${active.length} participants must grant fresh consent`)
})()
