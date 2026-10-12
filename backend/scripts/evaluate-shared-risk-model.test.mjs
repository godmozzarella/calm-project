import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./evaluate-shared-risk-model.js', import.meta.url), 'utf8')
const pseudonymSecret = 'test-only-evaluation-secret-at-least-32-bytes'
const featureNames = [
	'weatherScore', 'pressureHpa', 'pressureDelta24h', 'humidity', 'tempMin', 'tempMax',
	'windKmhMax', 'kpIndex', 'attacksLast3Days', 'attacksLast7Days',
	'medicationDaysLast7Days', 'overuseRisk', 'historyDays', 'historyAttackDays',
	'attackStartsLast14Days', 'attackStartsLast30Days',
	'meanAttackIntensityLast30Days', 'daysSinceLastAttackStart',
]

const makeExamples = (participantCount, daysPerParticipant = 10) => Array.from(
	{ length: participantCount * daysPerParticipant },
	(_, index) => {
		const participantIndex = Math.floor(index / daysPerParticipant)
		const dayIndex = index % daysPerParticipant
		const outcome = dayIndex < Math.ceil(daysPerParticipant * 0.3) ? 1 : 0
		const participantKey = createHmac('sha256', pseudonymSecret).update(`user-${participantIndex}`).digest('hex')
		return {
			_id: `gen_${participantKey}_${participantIndex}_${dayIndex}`,
			generation: 'active-generation',
			participantKey,
			targetDate: new Date(Date.UTC(2026, 0, 1 + dayIndex)).toISOString().slice(0, 10),
			outcome,
			baselineScore: outcome ? 15 : 75,
			baselineLevel: outcome ? 'LOW' : 'HIGH',
			scoringVersion: 'personal-rules-v1',
			featureSchemaVersion: 2,
			features: Object.fromEntries(featureNames.map(name => [name,
				name === 'overuseRisk' ? false : name === 'weatherScore' ? (outcome ? 85 : 15) :
				name === 'tempMin' ? null : name === 'attacksLast3Days' ? outcome : 0])),
		}
	},
)

const makeCollection = rows => ({
	rows,
	findOne: query => rows.find(row => row._id === query._id) ?? null,
	find: query => ({ toArray: () => rows.filter(row => row.generation === query.generation) }),
	insertOne: row => { rows.push(row); return { insertedId: row._id } },
})

const evaluate = (rows, { generatedAt = new Date(), withdrawnUser = null,
	consentVersion = 'shared-model-pilot-v1', featureSchemaVersion = 2,
	scoringVersion = 'personal-rules-v1' } = {}) => {
	const candidates = makeCollection([])
	const evaluations = makeCollection([])
	const liveModels = makeCollection([{ _id: 'active', version: 'unchanged' }])
	const sourceParticipants = Array.from({ length: 100 }, (_, index) => ({
		userId: `user-${index}`, participating: index !== withdrawnUser,
		consentVersion: 'shared-model-pilot-v1',
		consentDigest: 'a'.repeat(64),
	}))
	const source = {
		risk_model_consent_policy: { findOne: () => ({ version: 'shared-model-pilot-v1', digest: 'a'.repeat(64) }) },
		risk_model_participation: { find: query => ({ toArray: () => sourceParticipants.filter(row =>
			row.participating === query.participating && row.consentVersion === query.consentVersion) }) },
	}
	const context = {
		process: { env: {
			CALM_TRAINING_SOURCE_URI: 'mongodb://localhost:27017/calm',
			CALM_TRAINING_HMAC_KEY: pseudonymSecret,
			CALM_RISK_CONSENT_VERSION: 'shared-model-pilot-v1',
			CALM_RISK_CONSENT_DIGEST: 'a'.repeat(64),
		} },
		Mongo: class { getDB(name) { assert.equal(name, 'calm'); return source } },
		Buffer,
		db: {
			getName: () => 'calm_risk_training',
			export_metadata: makeCollection([{ _id: 'active', generation: 'active-generation', generatedAt,
				consentVersion, consentDigest: 'a'.repeat(64), featureSchemaVersion, scoringVersion }]),
			training_examples: makeCollection(rows),
			risk_model_candidates: candidates,
			risk_model_evaluations: evaluations,
			risk_model_active: liveModels,
		},
		require: name => { assert.equal(name, 'crypto'); return crypto },
		printjson: () => {},
	}
	runInNewContext(script, context)
	return { candidates, evaluations, liveModels }
}

test('blocks cohorts below three participants without creating a candidate or changing the live model', () => {
	const { candidates, evaluations, liveModels } = evaluate(makeExamples(2))
	assert.equal(evaluations.rows[0].status, 'INSUFFICIENT_DATA')
	assert.ok(evaluations.rows[0].reasons.includes('participants < 3'))
	assert.equal(candidates.rows.length, 0)
	assert.deepEqual(liveModels.rows, [{ _id: 'active', version: 'unchanged' }])
})

test('allows a three-participant evaluation only when outcome and holdout minimums are also met', () => {
	const { candidates, evaluations, liveModels } = evaluate(makeExamples(3, 40))
	const result = evaluations.rows[0]
	assert.equal(result.status, 'EVALUATED_OFFLINE_ONLY', JSON.stringify(result.reasons))
	assert.equal(result.overall.participants, 3)
	assert.equal(result.holdout.participants, 1)
	assert.equal(candidates.rows.length, 1)
	assert.equal(candidates.rows[0].status, 'OFFLINE_ONLY_NEVER_AUTO_ACTIVATE')
	assert.deepEqual(liveModels.rows, [{ _id: 'active', version: 'unchanged' }])
})

test('holds out whole participants, compares against the rules, and never activates the candidate', () => {
	const { candidates, evaluations, liveModels } = evaluate(makeExamples(30))
	const result = evaluations.rows[0]
	assert.equal(result.status, 'EVALUATED_OFFLINE_ONLY')
	assert.equal(result.holdout.participants, 6)
	assert.equal(result.holdout.examples, 60)
	assert.equal(result.holdout.attackDays, 18)
	assert.equal(result.holdout.noAttackDays, 42)
	assert.equal(result.metrics.candidateWorthHumanReview, true)
	assert.equal(candidates.rows.length, 1)
	assert.equal(candidates.rows[0].status, 'OFFLINE_ONLY_NEVER_AUTO_ACTIVATE')
	assert.equal('participantKey' in candidates.rows[0], false)
	assert.equal('userId' in candidates.rows[0], false)
	assert.deepEqual(liveModels.rows, [{ _id: 'active', version: 'unchanged' }])
})

test('refuses a stale export or withdrawn participant before saving an evaluation', () => {
	assert.throws(() => evaluate(makeExamples(30), {
		generatedAt: new Date(Date.now() - 16 * 60_000),
	}), /stale/)
	assert.throws(() => evaluate(makeExamples(30), { withdrawnUser: 0 }), /withdrawn or deleted/)
})

test('refuses an export from another consent or feature version', () => {
	for (const options of [
		{ consentVersion: 'old-consent' },
		{ featureSchemaVersion: 0 },
		{ scoringVersion: 'old-rules' },
	]) {
		assert.throws(() => evaluate(makeExamples(30), options), /incompatible/)
	}
})
