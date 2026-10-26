import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./migrate-personal-medications.js', import.meta.url), 'utf8')

const setup = apply => {
	const medicines = [
		{ _id: 'm1', userId: 'u1', name: 'Мой препарат', category: 'Другое' },
		{ _id: 'm2', userId: 'u1', name: 'Ибупрофен', category: 'Таблетки' },
	]
	const snapshots = [{ _id: 's1', userId: 'u1', historyDetails: { medicationNamesLast30Days: [
		{ code: 'Мой препарат', count: 2 }, { code: 'Ибупрофен', count: 1 },
	] } }]
	const personals = []
	const collection = rows => ({
		createIndex: () => 'user_name_unique',
		find: query => ({ toArray: () => rows.filter(row =>
			Object.entries(query).every(([field, expected]) => {
				if (field === 'historyDetails.medicationNamesLast30Days')
					return expected.$exists === Array.isArray(row.historyDetails?.medicationNamesLast30Days)
				return row[field] === expected
			})) }),
		findOneAndUpdate: (query, update) => {
			let row = rows.find(item => item.userId === query.userId && item.normalizedName === query.normalizedName)
			if (!row) { row = { _id: `p${rows.length + 1}`, ...update.$setOnInsert }; rows.push(row) }
			return row
		},
		updateOne: (query, update) => {
			const row = rows.find(item => item._id === query._id)
			for (const [path, value] of Object.entries(update.$set)) {
				if (path.includes('.')) row.historyDetails.medicationNamesLast30Days = value
				else row[path] = value
			}
		},
	})
	const db = {
		getName: () => 'calm_test',
		dictionaries: collection([{ type: 'MEDICATION_PRESET', label: 'Ибупрофен' }]),
		medications: collection(medicines),
		risk_training_input_snapshots: collection(snapshots),
		personal_medications: collection(personals),
	}
	const output = []
	const context = {
		db,
		process: { env: {
			CALM_PERSONAL_MEDICATION_MIGRATION_DB: 'calm_test',
			CALM_PERSONAL_MEDICATION_MIGRATION_APPLY: apply ? 'YES' : '',
		} },
		print: value => output.push(value),
		Date, JSON, Map, Set, Object, String, Array,
	}
	return { context, medicines, snapshots, personals, output }
}

test('dry run does not change records', () => {
	const fixture = setup(false)
	runInNewContext(script, fixture.context)
	assert.equal(fixture.medicines[0].name, 'Мой препарат')
	assert.equal(fixture.personals.length, 0)
	assert.equal(fixture.snapshots[0].historyDetails.medicationNamesLast30Days[0].code, 'Мой препарат')
	assert.match(fixture.output[0], /Would update medication records: 1; training snapshots: 1/)
})

test('apply keeps private name only in personal list and preserves catalog name', () => {
	const fixture = setup(true)
	runInNewContext(script, fixture.context)
	assert.equal(fixture.medicines[0].name, 'Свой препарат')
	assert.equal(fixture.medicines[0].personalMedicationId, 'p1')
	assert.equal(fixture.personals[0].name, 'Мой препарат')
	assert.equal(fixture.medicines[1].name, 'Ибупрофен')
	assert.equal(fixture.snapshots[0].historyDetails.medicationNamesLast30Days[0].code, 'Ибупрофен')
	assert.equal(fixture.snapshots[0].historyDetails.medicationNamesLast30Days[1].code, 'Свой препарат')
})

test('personal name matching the public catalog is still anonymized', () => {
	const fixture = setup(true)
	fixture.medicines[0].name = 'Ибупрофен'
	fixture.snapshots[0].historyDetails.medicationNamesLast30Days = [{ code: 'Ибупрофен', count: 1 }]
	runInNewContext(script, fixture.context)
	assert.equal(fixture.snapshots[0].historyDetails.medicationNamesLast30Days[0].code, 'Свой препарат')
})
