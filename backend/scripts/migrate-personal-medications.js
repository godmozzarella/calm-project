// Run with mongosh against the app database. Dry run by default.
// Apply only after a verified backup:
// CALM_PERSONAL_MEDICATION_MIGRATION_DB=calm CALM_PERSONAL_MEDICATION_MIGRATION_APPLY=YES mongosh ... --file backend/scripts/migrate-personal-medications.js
(() => {
  const expectedDb = process.env.CALM_PERSONAL_MEDICATION_MIGRATION_DB
  if (!expectedDb || db.getName() !== expectedDb) throw new Error('Set CALM_PERSONAL_MEDICATION_MIGRATION_DB to the connected application database')
  const apply = process.env.CALM_PERSONAL_MEDICATION_MIGRATION_APPLY === 'YES'
  if (apply) db.personal_medications.createIndex(
    { userId: 1, normalizedName: 1 }, { unique: true, name: 'user_name_unique' })
  const generic = 'Свой препарат'
  const publicNames = new Set([
    'Суматриптан', 'Золмитриптан', 'Элетриптан', 'Нурофен', 'Ибупрофен',
    'Найз', 'Аспирин', 'Парацетамол', 'Кетопрофен', 'Нурофен Экспресс',
    'Аспирин УПСА', 'Имигран спрей', 'Золмитриптан спрей',
  ].map(name => name.toLowerCase()))
  for (const entry of db.dictionaries.find({ type: 'MEDICATION_PRESET' }).toArray()) {
    if (entry.label) publicNames.add(entry.label.toLowerCase())
    if (entry.value) publicNames.add(entry.value.toLowerCase())
  }
  const personalNamesByUser = new Map()
  const addPersonalName = (userId, name) => {
    if (!userId || typeof name !== 'string') return
    if (!personalNamesByUser.has(userId)) personalNamesByUser.set(userId, new Set())
    personalNamesByUser.get(userId).add(name.toLowerCase())
  }
  for (const personal of db.personal_medications.find({}).toArray()) {
    addPersonalName(personal.userId, personal.name)
  }

  let medicationCount = 0
  for (const medication of db.medications.find({ category: 'Другое' }).toArray()) {
    if (medication.personalMedicationId || !medication.name || medication.name === generic) continue
    addPersonalName(medication.userId, medication.name)
    const name = medication.name.trim().replace(/\s+/g, ' ')
    if (!name) continue
    medicationCount++
    if (!apply) continue
    const normalizedName = name.normalize('NFKC').toLowerCase()
    const personal = db.personal_medications.findOneAndUpdate(
      { userId: medication.userId, normalizedName },
      { $setOnInsert: { userId: medication.userId, name, normalizedName, createdAt: new Date() } },
      { upsert: true, returnDocument: 'after' },
    )
    db.medications.updateOne({ _id: medication._id }, {
      $set: { personalMedicationId: personal._id, name: generic },
    })
  }

  let snapshotCount = 0
  for (const snapshot of db.risk_training_input_snapshots.find({ 'historyDetails.medicationNamesLast30Days': { $exists: true } }).toArray()) {
    const entries = snapshot.historyDetails?.medicationNamesLast30Days
    if (!Array.isArray(entries)) continue
    const counts = new Map()
    for (const entry of entries) {
      if (typeof entry.code !== 'string') continue
      const normalized = entry.code.toLowerCase()
      const code = publicNames.has(normalized) && !personalNamesByUser.get(snapshot.userId)?.has(normalized)
        ? entry.code : generic
      counts.set(code, (counts.get(code) ?? 0) + entry.count)
    }
    const safe = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([code, count]) => ({ code, count }))
    if (JSON.stringify(entries) === JSON.stringify(safe)) continue
    snapshotCount++
    if (apply) db.risk_training_input_snapshots.updateOne({ _id: snapshot._id }, {
      $set: { 'historyDetails.medicationNamesLast30Days': safe },
    })
  }

  print(`${apply ? 'Updated' : 'Would update'} medication records: ${medicationCount}; training snapshots: ${snapshotCount}`)
})()
