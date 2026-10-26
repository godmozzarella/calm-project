import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./export-shared-risk-training-v3.js', import.meta.url), 'utf8')
const secret = 'v3-test-secret-with-at-least-thirty-two-bytes'
const date = key => new Date(`${key}T00:00:00.000Z`)
const key = daysAgo => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
const matches = (document, query) => Object.entries(query).every(([field, expected]) => {
	if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.includes(document[field])
	if (expected && typeof expected === 'object' && '$ne' in expected) return document[field] !== expected.$ne
	return document[field] === expected
})
const collection = initial => {
	const rows = [...initial]
	return {
		rows,
		find: (query, projection) => ({ toArray: () => rows.filter(row => matches(row, query)).map(row =>
			projection ? Object.fromEntries(Object.keys(projection).filter(field => projection[field] && field in row)
				.map(field => [field, row[field]])) : row) }),
		insertMany: documents => { rows.push(...documents); return { insertedCount: documents.length } },
		countDocuments: query => rows.filter(row => matches(row, query)).length,
		deleteMany: query => {
			for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], query)) rows.splice(i, 1)
		},
		replaceOne: (_query, replacement) => { rows.splice(0, rows.length, replacement) },
	}
}

const features = {
	weatherScore: 45, pressureMmHg: 756.1, pressureDelta24hMmHg: -1.5, humidity: 60, humidityDelta24h: 5,
	tempMin: 8, tempMax: 16, windKmhMax: 15, kpIndex: 2,
	attacksLast3Days: 1, attacksLast7Days: 1, medicationDaysLast7Days: 1,
	overuseRisk: false, historyDays: 30, historyAttackDays: 4,
	attackStartsLast14Days: 1, attackStartsLast30Days: 1,
	meanAttackIntensityLast30Days: 6, daysSinceLastAttackStart: 1,
}
const historyDetails = {
	painTypesLast30Days: [{ code: 'PULSATING', count: 1 }],
	symptomsLast30Days: [{ code: 'nausea', count: 1 }],
	triggersLast30Days: [{ code: 'stress', count: 1 }],
	painZonesLast30Days: [{ code: 'forehead:red', count: 1 }],
	medicationNamesLast30Days: [{ code: 'test medicine', count: 1 }],
	medicationClassesLast30Days: [{ code: 'nsaid', count: 1 }],
	medicationEffectivenessLast30Days: [{ code: '3', count: 1 }],
	linkedMedicationEntriesLast30Days: 1,
	ongoingAttackAtCutoff: false,
}

const setup = () => {
	const target = key(1)
	const start = key(2)
	const source = {
		getName: () => 'calm_risk_pipeline_test_source',
		risk_model_participation: collection([
			{ userId: 'u1', participating: true, consentVersion: 'shared-model-pilot-v2' },
			{ userId: 'u2', participating: false, consentVersion: 'shared-model-pilot-v2' },
		]),
		risk_daily_outcomes: collection([{ userId: 'u1', date: date(target) }]),
		attacks: collection([{
			_id: 'attack-1', userId: 'u1', startDate: date(start), startTime: '10:15:00',
			endDate: date(target), endTime: '11:45:00', ongoing: false, intensity: 7,
			type: 'PULSATING', symptoms: ['nausea'], triggers: ['stress'],
			painZones: { forehead: 'red' }, note: 'private note',
		}]),
		medications: collection([{
			_id: 'med-1', userId: 'u1', date: date(target), time: '11:00:00',
			name: 'test medicine', therapeuticClass: 'nsaid', purpose: 'acute',
			attackId: 'attack-1', effectiveness: 3, note: 'private medicine note',
		}]),
		personal_medications: collection([]),
		dictionaries: collection([{ type: 'MEDICATION_PRESET', value: 'test_medicine', label: 'test medicine' }]),
		risk_training_input_snapshots: collection([{
			userId: 'u1', targetDate: date(target),
			capturedAt: new Date(date(target).getTime() - 12 * 3_600_000),
			timezone: 'UTC', locationKey: '55.75,37.62', baselineScore: 42,
			baselineLevel: 'MEDIUM', featureSchemaVersion: 3,
			scoringVersion: 'personal-rules-v1', features, historyDetails,
		}]),
	}
	const destination = {
		training_examples: collection([{ _id: 'old', generation: 'old' }]),
		risk_model_candidates: collection([]),
		risk_model_evaluations: collection([]),
		export_metadata: collection([]),
	}
	const context = {
		db: source,
		Mongo: class { getDB(name) { assert.equal(name, 'calm_risk_pipeline_test_training'); return destination } },
		process: { env: {
			CALM_RISK_TRAINING_TEST_MODE: 'YES',
			CALM_TRAINING_MONGO_URI: 'mongodb://localhost:27017/calm_risk_pipeline_test_training',
			CALM_TRAINING_HMAC_KEY: secret,
			CALM_TRAINING_REBUILD_CONFIRM: 'YES',
		} },
		require: name => { assert.equal(name, 'crypto'); return crypto },
		Buffer, Intl, Date, Map, Set, Object, Number, String, RegExp, Error,
		print: () => {},
	}
	return { source, destination, context, target }
}

test('exports detailed outcomes and frozen history under new consent without identifiers or notes', () => {
	const { source, destination, context, target } = setup()
	runInNewContext(script, context)
	assert.equal(destination.training_examples.rows.length, 1)
	const row = destination.training_examples.rows[0]
	assert.equal(row.targetDate, target)
	assert.equal(row.outcome, 1)
	assert.equal(row.attackCount, 1)
	assert.equal(row.forecastTimezone, 'UTC')
	assert.equal(row.locationGrid, '55.8,37.6')
	assert.equal(row.diaryOutcome.attacks[0].painType, 'PULSATING')
	assert.equal(row.diaryOutcome.attacks[0].startTime, '10:15')
	assert.equal(row.diaryOutcome.attacks[0].endTime, '11:45')
	assert.equal(row.diaryOutcome.attacks[0].medicationTaken, true)
	assert.equal(row.diaryOutcome.medications[0].effectiveness, 3)
	assert.equal(row.diaryOutcome.medications[0].linkedAttackKey, row.diaryOutcome.attacks[0].attackKey)
	assert.equal(row.historyDetails.symptomsLast30Days[0].code, 'nausea')
	assert.equal(row.historyDetails.medicationNamesLast30Days[0].code, 'test medicine')
	assert.equal(row.binaryPrediction, null)
	assert.equal(row.predictionMatched, null)
	assert.equal(row.features.weatherScore, 45)
	assert.equal(row.features.humidityDelta24h, 5)
	assert.equal(row.features.pressureMmHg, 756.1)
	assert.equal(row.features.pressureDelta24hMmHg, -1.5)
	assert.equal('pressureHpa' in row.features, false)
	assert.equal(row.featureSchemaVersion, 3)
	assert.equal(destination.export_metadata.rows[0].detailSchemaVersion, 1)
	assert.equal('userId' in row, false)
	assert.equal('note' in row.diaryOutcome.attacks[0], false)
	assert.equal('note' in row.diaryOutcome.medications[0], false)
	assert.equal('locationKey' in row, false)
	assert.equal(source.attacks.rows[0].note, 'private note')
})

test('requires new consent and a version 3 pre-day snapshot', () => {
	for (const change of [
		setup => { setup.source.risk_model_participation.rows[0].consentVersion = 'shared-model-pilot-v1' },
		setup => { setup.source.risk_model_participation.rows[0].adminBlocked = true },
		setup => { setup.source.risk_training_input_snapshots.rows[0].featureSchemaVersion = 2 },
		setup => { setup.source.risk_training_input_snapshots.rows[0].capturedAt = date(setup.target) },
	]) {
		const fixture = setup()
		change(fixture)
		runInNewContext(script, fixture.context)
		assert.equal(fixture.destination.training_examples.rows.length, 0)
	}
})

test('replaces custom medicine names in outcome and older frozen history', () => {
	const fixture = setup()
	fixture.source.personal_medications.rows.push({ userId: 'u1', name: 'Мой препарат' })
	fixture.source.medications.rows[0].name = 'Свой препарат'
	fixture.source.medications.rows[0].category = 'Другое'
	fixture.source.medications.rows[0].personalMedicationId = 'personal-1'
	fixture.source.risk_training_input_snapshots.rows[0].historyDetails = {
		...historyDetails,
		medicationNamesLast30Days: [{ code: 'Мой препарат', count: 1 }],
	}

	runInNewContext(script, fixture.context)
	const row = fixture.destination.training_examples.rows[0]
	assert.equal(row.diaryOutcome.medications[0].name, 'Свой препарат')
	assert.equal(row.historyDetails.medicationNamesLast30Days[0].code, 'Свой препарат')
})

test('personal name matching the public catalog stays generic in old history', () => {
	const fixture = setup()
	fixture.source.personal_medications.rows.push({ userId: 'u1', name: 'test medicine' })
	fixture.source.medications.rows[0].name = 'Свой препарат'
	fixture.source.medications.rows[0].category = 'Другое'
	fixture.source.medications.rows[0].personalMedicationId = 'personal-1'
	runInNewContext(script, fixture.context)
	const row = fixture.destination.training_examples.rows[0]
	assert.equal(row.diaryOutcome.medications[0].name, 'Свой препарат')
	assert.equal(row.historyDetails.medicationNamesLast30Days[0].code, 'Свой препарат')
})
