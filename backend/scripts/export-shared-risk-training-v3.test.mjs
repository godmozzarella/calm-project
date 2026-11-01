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
		findOne: query => rows.find(row => matches(row, query)) ?? null,
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

const setup = (testMode = true) => {
	const target = key(1)
	const start = key(2)
	const source = {
		getName: () => testMode ? 'calm_risk_pipeline_test_source' : 'calm',
		risk_model_consent_policy: collection([{ _id: 'current', version: 'shared-model-pilot-v2', digest: 'a'.repeat(64) }]),
        users: collection([{ _id: 'u1', latitude: 55.75, longitude: 37.62, city: 'City A' }]),
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
			name: 'test medicine', dosage: '400 mg', intakeId: 'private-intake-id', therapeuticClass: 'nsaid', purpose: 'acute',
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
		diary_events: collection([]),
		risk_model_candidates: collection([]),
		risk_model_evaluations: collection([]),
		export_metadata: collection([]),
	}
	const context = {
		db: source,
		Mongo: class { getDB(name) { assert.equal(name, testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'); return destination } },
		process: { env: {
			CALM_RISK_TRAINING_TEST_MODE: testMode ? 'YES' : 'NO',
			CALM_TRAINING_MONGO_URI: `mongodb://localhost:27017/${testMode ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'}`,
			CALM_TRAINING_HMAC_KEY: secret,
			CALM_TRAINING_REBUILD_CONFIRM: 'YES',
			CALM_RISK_CONSENT_VERSION: 'shared-model-pilot-v2',
			CALM_RISK_CONSENT_DIGEST: 'a'.repeat(64),
			CALM_HISTORICAL_WEATHER_ENABLED: 'false',
		} },
		require: name => { assert.equal(name, 'crypto'); return crypto },
		Buffer, Intl, Date, Map, Set, Object, Number, String, RegExp, Error,
		logs: [],
		print: (...parts) => context.logs.push(parts.join(' ')),
	}
	return { source, destination, context, target }
}

test('exports detailed outcomes and frozen history under new consent without identifiers or notes', async () => {
	const { source, destination, context, target } = setup()
	await runInNewContext(script, context)
	assert.equal(destination.training_examples.rows.length, 2)
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
	assert.equal(row.diaryOutcome.medications[0].dosage, '400 mg')
	assert.equal(row.diaryOutcome.medications[0].intakeKey.length, 64)
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

test('consent remains required but a missing or late snapshot does not exclude diary data', async () => {
    for (const change of [
        fixture => { fixture.source.risk_model_participation.rows[0].consentVersion = 'old' },
        fixture => { fixture.source.risk_model_participation.rows[0].adminBlocked = true },
    ]) {
        const fixture = setup(); change(fixture); await runInNewContext(script, fixture.context)
        assert.equal(fixture.destination.training_examples.rows.length, 0)
    }
    for (const change of [
        fixture => { fixture.source.risk_training_input_snapshots.rows.splice(0) },
        fixture => { fixture.source.risk_training_input_snapshots.rows[0].featureSchemaVersion = 2 },
        fixture => { fixture.source.risk_training_input_snapshots.rows[0].capturedAt = date(fixture.target) },
    ]) {
        const fixture = setup(); change(fixture); await runInNewContext(script, fixture.context)
        assert.equal(fixture.destination.training_examples.rows.length, 2)
        assert.equal(fixture.destination.training_examples.rows.some(row => row.trainingEligible), false)
    }
})

test('replaces custom medicine names in outcome and older frozen history', async () => {
	const fixture = setup()
	fixture.source.personal_medications.rows.push({ userId: 'u1', name: 'Мой препарат' })
	fixture.source.medications.rows[0].name = 'Свой препарат'
	fixture.source.medications.rows[0].category = 'Другое'
	fixture.source.medications.rows[0].personalMedicationId = 'personal-1'
	fixture.source.risk_training_input_snapshots.rows[0].historyDetails = {
		...historyDetails,
		medicationNamesLast30Days: [{ code: 'Мой препарат', count: 1 }],
	}

	await runInNewContext(script, fixture.context)
	const row = fixture.destination.training_examples.rows[0]
	assert.equal(row.diaryOutcome.medications[0].name, 'Свой препарат')
	assert.equal(row.historyDetails.medicationNamesLast30Days[0].code, 'Свой препарат')
})

test('personal name matching the public catalog stays generic in old history', async () => {
	const fixture = setup()
	fixture.source.personal_medications.rows.push({ userId: 'u1', name: 'test medicine' })
	fixture.source.medications.rows[0].name = 'Свой препарат'
	fixture.source.medications.rows[0].category = 'Другое'
	fixture.source.medications.rows[0].personalMedicationId = 'personal-1'
	await runInNewContext(script, fixture.context)
	const row = fixture.destination.training_examples.rows[0]
	assert.equal(row.diaryOutcome.medications[0].name, 'Свой препарат')
	assert.equal(row.historyDetails.medicationNamesLast30Days[0].code, 'Свой препарат')
})


test('keeps old attacks, symptoms, zones and medicines in the same dataset with null forecast fields', async () => {
    const fixture = setup()
    fixture.source.risk_training_input_snapshots.rows.splice(0)
    await runInNewContext(script, fixture.context)
    assert.equal(fixture.destination.training_examples.rows.length, 2)
    assert.equal(fixture.destination.diary_events.rows.length, 0)
    const row = fixture.destination.training_examples.rows.find(row => row.targetDate === fixture.target)
    assert.equal(row.outcome, 1)
    assert.equal(row.features.weatherScore, null)
    assert.equal(row.features.overuseRisk, null)
    assert.equal(row.baselineScore, null)
    assert.equal(row.forecastTimezone, null)
    assert.equal(row.historyDetails, null)
    assert.equal(row.trainingEligible, false)
    assert.equal(row.diaryOutcome.attacks[0].symptoms[0], 'nausea')
    assert.equal(row.diaryOutcome.attacks[0].painZones[0].zone, 'forehead')
    assert.equal(row.diaryOutcome.attacks[0].linkedMedications[0].effectiveness, 3)
    assert.equal(row.diaryOutcome.medications[0].linkedAttackKey, row.diaryOutcome.attacks[0].attackKey)
    const text = JSON.stringify(fixture.destination.training_examples.rows)
    for (const secret of ['private note', 'private medicine note', 'userId', 'attack-1', 'private-intake-id']) assert.equal(text.includes(secret), false)
    fixture.source.risk_model_participation.rows[0].participating = false
    await runInNewContext(script, fixture.context)
    assert.equal(fixture.destination.training_examples.rows.length, 0)
    assert.equal(fixture.source.attacks.rows.length, 1)
})

test('multiple attacks on the same day remain distinct and later edits do not duplicate rows', async () => {
    const fixture = setup()
    fixture.source.risk_training_input_snapshots.rows.splice(0)
    const first = fixture.source.attacks.rows[0]
    first.startDate = date(fixture.target)
    fixture.source.attacks.rows.push({ ...first, _id: 'second', intensity: 9, symptoms: null, painZones: null })
    await runInNewContext(script, fixture.context)
    let row = fixture.destination.training_examples.rows[0]
    assert.equal(fixture.destination.training_examples.rows.length, 1)
    assert.equal(row.attackCount, 2)
    assert.equal(new Set(row.diaryOutcome.attacks.map(a => a.attackKey)).size, 2)
    assert.equal(row.diaryOutcome.attacks[1].symptoms, null)
    assert.equal(row.diaryOutcome.attacks[1].painZones, null)
    first.intensity = 4
    fixture.source.attacks.rows.splice(1)
    await runInNewContext(script, fixture.context)
    row = fixture.destination.training_examples.rows[0]
    assert.equal(row.attackCount, 1)
    assert.equal(row.diaryOutcome.attacks[0].intensity, 4)
    assert.equal(fixture.destination.training_examples.rows.length, 1)
})

test('includes ongoing/current attacks and medicine-only days without inventing negative labels', async () => {
    const fixture = setup()
    fixture.source.risk_training_input_snapshots.rows.splice(0)
    fixture.source.attacks.rows[0].ongoing = true
    fixture.source.attacks.rows[0].endDate = null
    fixture.source.medications.rows.push({ _id: 'unlinked', userId: 'u1', date: date(key(10)), effectiveness: null })
    await runInNewContext(script, fixture.context)
    const rows = fixture.destination.training_examples.rows
    assert.equal(rows.find(row => row.targetDate === key(0)).outcome, 1)
    assert.equal(rows.find(row => row.targetDate === key(0)).dayCompleted, false)
    const medicineOnly = rows.find(row => row.targetDate === key(10))
    assert.equal(medicineOnly.outcome, null)
    assert.equal(medicineOnly.diaryOutcome.medications[0].effectiveness, null)
    assert.equal(medicineOnly.diaryOutcome.medications[0].linkedAttackKey, null)
})

test('preserves available partial and late forecast values without filling missing values', async () => {
    const fixture = setup()
    const snapshot = fixture.source.risk_training_input_snapshots.rows[0]
    snapshot.features = { pressureMmHg: 750, overuseRisk: false }
    snapshot.capturedAt = new Date(date(fixture.target).getTime() + 3600000)
    snapshot.historyDetails = null
    await runInNewContext(script, fixture.context)
    const row = fixture.destination.training_examples.rows.find(row => row.targetDate === fixture.target)
    assert.equal(row.features.pressureMmHg, 750)
    assert.equal(row.features.weatherScore, null)
    assert.equal(row.features.overuseRisk, false)
    assert.equal(row.snapshotTiming, 'LATE')
    assert.equal(row.trainingEligible, false)
})

test('future forecast snapshots do not turn an ongoing attack into invented future outcomes', async () => {
    const fixture = setup()
    fixture.source.attacks.rows[0].ongoing = true
    fixture.source.attacks.rows[0].endDate = null
    fixture.source.risk_training_input_snapshots.rows.push({ ...fixture.source.risk_training_input_snapshots.rows[0], targetDate: date(key(-1)) })
    await runInNewContext(script, fixture.context)
    assert.equal(fixture.destination.training_examples.rows.some(row => row.targetDate > key(0)), false)
})

test('an old attack missing dates is retained with null dates instead of silently discarded', async () => {
    const fixture = setup()
    fixture.source.attacks.rows.push({ _id: 'undated', userId: 'u1', intensity: 6 })
    await runInNewContext(script, fixture.context)
    const row = fixture.destination.training_examples.rows.find(row => row.targetDate === null)
    assert.equal(row.diaryOutcome.attacks[0].startDate, null)
    assert.equal(row.diaryOutcome.attacks[0].intensity, 6)
    assert.equal(row.features.weatherScore, null)
})

test('frozen event city survives a profile move and cached archive fills only absent parameters', async () => {
    const fixture = setup()
    fixture.source.risk_training_input_snapshots.rows.splice(0)
    fixture.source.attacks.rows[0].eventLocation = { latitude: 50, longitude: 30, source: 'CONFIRMED_AUTO' }
    fixture.destination.export_metadata.rows.push({ _id: 'active', generation: 'old' })
    fixture.destination.training_examples.rows.push({ generation: 'old', historicalWeather: {
        cacheKey: `50.0,30.0|${fixture.target}`, locationGrid: '50.0,30.0', source: 'OPEN_METEO_ARCHIVE', features: { pressureMmHg: 750 },
    } })
    await runInNewContext(script, fixture.context)
    const row = fixture.destination.training_examples.rows.find(row => row.targetDate === fixture.target)
    assert.equal(row.diaryOutcome.attacks[0].location.locationGrid, '50.0,30.0')
    assert.equal(row.diaryOutcome.attacks[0].historicalWeather.features.pressureMmHg, 750)
    assert.equal(row.profileLocation.locationGrid, '55.8,37.6')
    assert.equal(row.weatherLocationsMixed, true) // medicine has a different assumed profile location
    assert.equal(row.features.pressureMmHg, null)
})

test('retrospective filling never silently becomes an eligible pre-day feature', async () => {
    const fixture = setup()
    fixture.source.risk_training_input_snapshots.rows[0].features = { ...features, pressureMmHg: null }
    fixture.destination.export_metadata.rows.push({ _id: 'active', generation: 'old' })
    fixture.destination.training_examples.rows.push({ generation: 'old', historicalWeather: {
        cacheKey: `55.8,37.6|${fixture.target}`, locationGrid: '55.8,37.6', features: { pressureMmHg: 750 },
    } })
    await runInNewContext(script, fixture.context)
    const row = fixture.destination.training_examples.rows.find(row => row.targetDate === fixture.target)
    assert.equal(row.features.pressureMmHg, 750)
    assert.equal(row.weatherFeatureSources.pressureMmHg, 'HISTORICAL_ARCHIVE')
    assert.equal(row.trainingEligible, false)
})

test('production export failures log safe stack frames without the exception message', async () => {
    const fixture = setup(false)
    fixture.destination.export_metadata.findOne = () => { throw new Error('synthetic private-value') }
    await assert.rejects(runInNewContext(script, fixture.context), /Training export stopped during 'prepare training rows'/)
    const output = fixture.context.logs.join('\n')
    assert.match(output, /Training export failed during 'prepare training rows': Error/)
    assert.match(output, /Training export stack frames:/)
    assert.equal(output.includes('synthetic private-value'), false)
})
