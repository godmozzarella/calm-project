import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./export-shared-risk-onset-v4.js', import.meta.url), 'utf8')
const matches = (row, query) => Object.entries(query).every(([key, value]) =>
  value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key])
    : value && typeof value === 'object' && '$ne' in value ? row[key] !== value.$ne : row[key] === value)
const collection = initial => {
  const rows = [...initial]
  return { rows, find: query => ({ toArray: () => rows.filter(r => matches(r, query)) }),
    findOne: query => rows.find(r => matches(r, query)),
    insertMany: values => rows.push(...values), countDocuments: query => rows.filter(r => matches(r, query)).length,
    replaceOne: (_, value) => rows.splice(0, rows.length, value),
    deleteMany: query => { for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], query)) rows.splice(i, 1) } }
}
const setup = () => {
  const policy = { _id: 'current', version: 'test-consent', digest: 'a'.repeat(64) }
  const input = { userId: 'u1', targetDate: '2026-11-01', timezone: 'UTC', featureSchemaVersion: 4,
    targetVersion: 'new-attack-onset-local-day-v1', protocolVersion: 'midnight-local-v1',
    consentVersion: policy.version, consentDigest: policy.digest,
    capturedAt: new Date('2026-10-31T23:59:30Z'), plannedIssueAt: new Date('2026-11-01T00:00:00Z'),
    targetEndAt: new Date('2026-11-02T00:00:00Z'), featureUsable: true,
    features: { episodeStartsLast7Days: 1, ongoingAtIssue: true, note: 'private', userId: 'private-id' },
    weatherForecast: { pressureMmHg: 750, latitude: 55.123456 }, qualityFlags: [] }
  const label = { userId: 'u1', targetDate: '2026-11-01', timezone: 'UTC', outcome: 0,
    headachePresent: true, dayCompleted: true, labelSource: 'USER_NO_NEW_START_MARK', revision: 1,
    matchedAttackIds: [] }
  const source = { getName: () => 'calm_risk_pipeline_test_source',
    risk_model_consent_policy: collection([policy]), users: collection([{ _id: 'u1' }]),
    risk_model_participation: collection([{ userId: 'u1', participating: true, consentVersion: policy.version, consentDigest: policy.digest }]),
    risk_onset_input_snapshots: collection([input]), risk_onset_daily_labels: collection([label]) }
  const destination = { onset_training_examples: collection([{ generation: 'old' }]), onset_export_metadata: collection([]),
    training_examples: collection([{ generation: 'legacy-v3' }]), export_metadata: collection([{ generation: 'legacy-v3' }]) }
  const context = { db: source, Mongo: class { getDB() { return destination } }, require: () => crypto, Buffer, Date,
    process: { env: { CALM_RISK_TRAINING_TEST_MODE: 'YES', CALM_TRAINING_MONGO_URI: 'mongodb://localhost/calm_risk_pipeline_test_training',
      CALM_TRAINING_HMAC_KEY: 'long-test-secret-for-onset-not-for-real-use', CALM_TRAINING_REBUILD_CONFIRM: 'YES',
      CALM_RISK_CONSENT_VERSION: policy.version, CALM_RISK_CONSENT_DIGEST: policy.digest } }, print() {} }
  return { source, destination, input, label, context }
}

test('exports onset zero alongside ongoing pain with explicit sources and no raw identifiers', () => {
  const f = setup(); runInNewContext(script, f.context)
  const row = f.destination.onset_training_examples.rows[0]
  assert.equal(row.outcome, 0); assert.equal(row.headachePresent, true); assert.equal(row.trainingEligible, true)
  assert.equal(row.labelSource, 'USER_NO_NEW_START_MARK')
  assert.equal(row.featureSchemaVersion, 4)
  assert.equal(row.features.episodeStartsLast7Days, 1)
  const text = JSON.stringify(row)
  for (const value of ['private-id', 'private', '55.123456', '"userId"']) assert.equal(text.includes(value), false)
  assert.equal(f.destination.training_examples.rows[0].generation, 'legacy-v3')
})

test('late label correction updates published truth without changing frozen features', () => {
  const f = setup(); runInNewContext(script, f.context)
  f.label.outcome = 1; f.label.revision = 2; f.label.matchedAttackIds = ['source-attack-id']
  runInNewContext(script, f.context)
  const row = f.destination.onset_training_examples.rows[0]
  assert.equal(row.outcome, 1); assert.equal(row.labelRevision, 2)
  assert.equal(row.features.episodeStartsLast7Days, 1)
  assert.match(row.matchedAttackKeys[0], /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(row).includes('source-attack-id'), false)
  assert.equal(f.destination.onset_training_examples.rows.length, 1)
})

test('unknown days, incomplete periods and late inputs remain visible but not eligible', () => {
  for (const mutate of [f => { f.label.outcome = null }, f => { f.label.dayCompleted = false },
    f => { f.input.capturedAt = new Date('2026-11-01T00:00:01Z') }]) {
    const f = setup(); mutate(f); runInNewContext(script, f.context)
    assert.equal(f.destination.onset_training_examples.rows.length, 1)
    assert.equal(f.destination.onset_training_examples.rows[0].trainingEligible, false)
  }
})

test('withdrawal removes the next published generation and preserves legacy collections', () => {
  const f = setup(); runInNewContext(script, f.context)
  f.source.risk_model_participation.rows[0].participating = false
  runInNewContext(script, f.context)
  assert.equal(f.destination.onset_training_examples.rows.length, 0)
  assert.equal(f.destination.onset_export_metadata.rows[0].exampleCount, 0)
  assert.equal(f.destination.training_examples.rows.length, 1)
})
