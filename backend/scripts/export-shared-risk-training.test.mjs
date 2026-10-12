import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./export-shared-risk-training.js', import.meta.url), 'utf8')
const secret = 'test-only-secret-with-at-least-thirty-two-bytes'

const matches = (document, query) => Object.entries(query).every(([key, expected]) => {
	if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.includes(document[key])
	if (expected && typeof expected === 'object' && '$ne' in expected) return document[key] !== expected.$ne
	return document[key] === expected
})

const collection = initial => {
	const rows = [...initial]
	return {
		rows,
		find: (query, projection) => ({ toArray: () => rows.filter(row => matches(row, query)).map(row => {
			if (!projection) return row
			return Object.fromEntries(Object.keys(projection).filter(key => projection[key] && key in row)
				.map(key => [key, row[key]]))
		}) }),
		insertMany: documents => {
			const existingIds = new Set(rows.map(row => row._id))
			if (documents.some(document => existingIds.has(document._id))) throw new Error('duplicate _id')
			rows.push(...documents)
			return { insertedCount: documents.length }
		},
		countDocuments: query => rows.filter(row => matches(row, query)).length,
		deleteMany: query => {
			let deletedCount = 0
			for (let i = rows.length - 1; i >= 0; i--) {
				if (matches(rows[i], query)) { rows.splice(i, 1); deletedCount++ }
			}
			return { deletedCount }
		},
		replaceOne: (_query, replacement) => { rows.splice(0, rows.length, replacement); return { matchedCount: 1 } },
	}
}

const makeDate = day => new Date(`${day}T00:00:00.000Z`)
const keyFor = userId => createHmac('sha256', secret).update(userId).digest('hex')
const features = {
	weatherScore: 44, pressureHpa: 1008, pressureDelta24h: -2.5, humidity: 67,
	tempMin: 8, tempMax: 16, windKmhMax: 12, kpIndex: 2,
	attacksLast3Days: 1, attacksLast7Days: 2, medicationDaysLast7Days: 1,
	overuseRisk: false, historyDays: 25, historyAttackDays: 4,
	attackStartsLast14Days: 2, attackStartsLast30Days: 4,
	meanAttackIntensityLast30Days: 6, daysSinceLastAttackStart: 1,
}

function setup({ revoked = false } = {}) {
	const today = new Date().toISOString().slice(0, 10)
	const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
	const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
	const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
	const beforeStart = (day, hours) => new Date(makeDate(day).getTime() - hours * 3_600_000)
	const predictions = [
		{ userId: 'u-active', targetDate: makeDate(yesterday), issuedAt: beforeStart(yesterday, 24), timezone: 'UTC', score: 38, level: 'MEDIUM', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(yesterday), issuedAt: beforeStart(yesterday, 12), timezone: 'UTC', score: 71, level: 'HIGH', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(yesterday), issuedAt: beforeStart(yesterday, 2), timezone: 'UTC', score: 98, level: 'HIGH', featureSchemaVersion: 1, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(yesterday), issuedAt: beforeStart(yesterday, 1), timezone: 'UTC', score: 97, level: 'HIGH', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features: { ...features, attackStartsLast14Days: 15 } },
		{ userId: 'u-active', targetDate: makeDate(yesterday), issuedAt: new Date(`${yesterday}T02:00:00Z`), timezone: 'UTC', score: 99, level: 'HIGH', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(twoDaysAgo), issuedAt: beforeStart(twoDaysAgo, 12), timezone: 'UTC', score: 10, level: 'LOW', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(twoDaysAgo), issuedAt: beforeStart(twoDaysAgo, 4), timezone: 'UTC', score: 99, level: 'HIGH', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v2', features },
		{ userId: 'u-active', targetDate: makeDate(threeDaysAgo), issuedAt: beforeStart(threeDaysAgo, 12), timezone: 'UTC', score: 20, level: 'LOW', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(threeDaysAgo), issuedAt: beforeStart(threeDaysAgo, 12), timezone: 'UTC', score: 20, level: 'LOW', featureSchemaVersion: 0, scoringVersion: 'old-rules', features },
		{ userId: 'u-active', targetDate: makeDate(threeDaysAgo), issuedAt: new Date(makeDate(threeDaysAgo).getTime() - 4 * 3_600_000), timezone: 'Europe/Moscow', score: 55, level: 'MEDIUM', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-active', targetDate: makeDate(threeDaysAgo), issuedAt: new Date(makeDate(threeDaysAgo).getTime() - 2 * 3_600_000), timezone: 'Europe/Moscow', score: 99, level: 'HIGH', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
		{ userId: 'u-not-consented', targetDate: makeDate(yesterday), issuedAt: beforeStart(yesterday, 12), timezone: 'UTC', score: 88, level: 'HIGH', featureSchemaVersion: 2, scoringVersion: 'personal-rules-v1', features },
	]
	const source = {
		getName: () => 'calm',
		risk_model_consent_policy: { findOne: () => ({ version: 'shared-model-pilot-v1', digest: 'a'.repeat(64) }) },
		risk_model_participation: collection([
			{ userId: 'u-active', participating: !revoked, consentVersion: 'shared-model-pilot-v1', consentDigest: 'a'.repeat(64) },
			{ userId: 'u-not-consented', participating: false, consentVersion: 'shared-model-pilot-v1', consentDigest: 'a'.repeat(64) },
		]),
		risk_daily_outcomes: collection([{ userId: 'u-active', date: makeDate(twoDaysAgo) }]),
		attacks: collection([
			{ userId: 'u-active', startDate: makeDate(yesterday) },
			{ userId: 'u-active', startDate: makeDate(threeDaysAgo) },
		]),
		risk_prediction_records: collection(predictions),
	}
	const destination = {
		training_examples: collection([
			{ _id: 'stale-row', generation: 'old', participantKey: keyFor('u-not-consented') },
		]),
		risk_model_candidates: collection([{ _id: 'stale-candidate', generation: 'old' }]),
		risk_model_evaluations: collection([{ _id: 'stale-evaluation', generation: 'old' }]),
		export_metadata: collection([]),
	}
	const context = {
		db: source,
		Mongo: class { getDB(name) { assert.equal(name, 'calm_risk_training'); return destination } },
		process: { env: {
			CALM_TRAINING_MONGO_URI: 'mongodb://localhost:27017/calm_risk_training',
			CALM_TRAINING_HMAC_KEY: secret,
			CALM_TRAINING_REBUILD_CONFIRM: 'YES',
			CALM_RISK_CONSENT_VERSION: 'shared-model-pilot-v1',
			CALM_RISK_CONSENT_DIGEST: 'a'.repeat(64),
		} },
		require: name => { assert.equal(name, 'crypto'); return awaitCrypto },
		Buffer,
		Intl,
		Date,
		Map,
		Set,
		Object,
		Number,
		String,
		RegExp,
		Error,
		print: () => {},
	}
	return { context, destination, yesterday, twoDaysAgo }
}

import * as awaitCrypto from 'node:crypto'

test('exports only consented, labeled, latest pre-day rows and strips account identifiers', () => {
	const { context, destination, yesterday, twoDaysAgo } = setup()
	runInNewContext(script, context)

	assert.equal(destination.training_examples.rows.length, 3,
		JSON.stringify(destination.training_examples.rows.map(row => ({ day: row.targetDate, outcome: row.outcome }))))
	const positive = destination.training_examples.rows.find(row => row.targetDate === yesterday)
	const negative = destination.training_examples.rows.find(row => row.targetDate === twoDaysAgo)
	const localBoundary = destination.training_examples.rows.find(row => row.targetDate !== yesterday && row.targetDate !== twoDaysAgo)
	assert.equal(positive.outcome, 1)
	assert.equal(positive.baselineScore, 71)
	assert.equal(negative.outcome, 0)
	assert.equal(negative.baselineScore, 10)
	assert.equal(localBoundary.outcome, 1)
	assert.equal(localBoundary.baselineScore, 55)
	assert.equal(positive.participantKey, keyFor('u-active'))
	assert.match(positive._id, new RegExp(`^${destination.export_metadata.rows[0].generation}_`))
	assert.equal(destination.training_examples.rows.some(row => row.participantKey === keyFor('u-not-consented')), false)
	for (const row of destination.training_examples.rows) {
		assert.equal('userId' in row, false)
		assert.equal('issuedAt' in row, false)
		assert.equal('timezone' in row, false)
		assert.deepEqual(Object.keys(row.features).sort(), Object.keys(features).sort())
	}
	assert.equal(destination.export_metadata.rows[0].exampleCount, 3)
	assert.equal(destination.risk_model_candidates.rows.length, 0)
	assert.equal(destination.risk_model_evaluations.rows.length, 0)
	const firstGeneration = destination.export_metadata.rows[0].generation
	runInNewContext(script, context)
	assert.notEqual(destination.export_metadata.rows[0].generation, firstGeneration)
	assert.equal(destination.training_examples.rows.length, 3)
})

test('a rebuild after withdrawal removes the participant and the prior generation', () => {
	const { context, destination } = setup({ revoked: true })
	runInNewContext(script, context)
	assert.equal(destination.training_examples.rows.length, 0)
	assert.equal(destination.export_metadata.rows[0].participantCount, 0)
	assert.equal(destination.export_metadata.rows[0].exampleCount, 0)
	assert.equal(destination.risk_model_candidates.rows.length, 0)
	assert.equal(destination.risk_model_evaluations.rows.length, 0)
})

test('refuses to overwrite the destination without explicit confirmation', () => {
	const { context, destination } = setup()
	context.process.env.CALM_TRAINING_REBUILD_CONFIRM = 'NO'
	assert.throws(() => runInNewContext(script, context), /REBUILD_CONFIRM=YES/)
	assert.equal(destination.training_examples.rows.length, 1)
})
