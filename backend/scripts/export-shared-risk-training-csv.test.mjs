import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./export-shared-risk-training-csv.js', import.meta.url), 'utf8')

function runExport(rows, metadata = { _id: 'active', generation: 'current' }) {
	const output = []
	const context = {
		db: {
			export_metadata: { findOne: query => {
				assert.equal(query._id, 'active')
				return metadata
			} },
			training_examples: { find: (query, projection) => {
				assert.equal(query.generation, metadata?.generation)
				assert.equal(projection.userId, undefined)
				return {
					sort: () => ({ forEach: callback => rows
						.filter(row => row.generation === query.generation)
						.forEach(callback) }),
				}
			} },
		},
		print: line => output.push(line),
	}
	runInNewContext(script, context)
	return output
}

test('exports only active pseudonymized examples as quoted CSV', () => {
	const output = runExport([
		{
			generation: 'current',
			participantKey: 'hmac-pseudonym',
			targetDate: '2026-10-12',
			outcome: 1,
			baselineScore: 41,
			baselineLevel: 'MEDIUM',
			userId: 'must-not-appear',
			features: { weatherScore: 30, overuseRisk: false, pressureHpa: '1000,"test"' },
		},
		{ generation: 'old', participantKey: 'old-pseudonym', targetDate: '2026-10-11' },
	])

	assert.equal(output.length, 2)
	assert.match(output[0], /^participantKey,targetDate,outcome,baselineScore,baselineLevel,/)
	assert.match(output[1], /^hmac-pseudonym,2026-10-12,1,41,MEDIUM,30,"1000,""test"""/)
	assert.equal(output.join('\n').includes('must-not-appear'), false)
	assert.equal(output.join('\n').includes('old-pseudonym'), false)
})

test('exports a header only when there is no active snapshot', () => {
	const output = runExport([], null)
	assert.equal(output.length, 1)
	assert.match(output[0], /^participantKey,targetDate,outcome,baselineScore,baselineLevel,/)
})

test('v3 CSV retains historical details and empty feature cells from the same dataset', () => {
    const output = runExport([{
        generation: 'current', participantKey: 'p', targetDate: '2020-01-01', outcome: 1,
        baselineScore: null, features: { weatherScore: null, pressureMmHg: null },
        attackCount: 1, trainingEligible: false, snapshotTiming: 'MISSING',
        diaryOutcome: { attacks: [{ symptoms: ['nausea'], painZones: [{ zone: 'forehead', color: 'red' }] }],
            medications: [{ effectiveness: null, linkedAttackKey: 'key' }] },
    }], { generation: 'current', featureSchemaVersion: 3 })
    assert.equal(output.length, 2)
    assert.match(output[0], /pressureMmHg,pressureDelta24hMmHg/)
    assert.match(output[0], /diaryOutcome,historyDetails/)
    assert.match(output[1], /^p,2020-01-01,1,,,,/)
    assert.match(output[1], /nausea/)
    assert.match(output[1], /forehead/)
    assert.match(output[1], /linkedAttackKey/)
})
