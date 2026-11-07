import assert from 'node:assert/strict'
import * as crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('./export-shared-risk-survey-v5.js', import.meta.url), 'utf8')
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
 const policy={_id:'current',version:'consent-v3',digest:'a'.repeat(64)}
 const entry={userId:'u1',date:'2026-01-01',timezone:'UTC',outcome:0,horizonCompleted:true,labelHistory:[{}],
   answers:{note:'secret-not-for-export'},prediction:{schemaVersion:5,protocol:'after-survey-local-day-v2',
   issuedAt:new Date('2026-01-01T09:00:00Z'),endAt:new Date('2026-01-02T00:00:00Z'),consentVersion:policy.version,consentDigest:policy.digest,
   features:{sleepMinutes:480,stress:0,alcoholYesterday:1,sex:'UNSPECIFIED',cycleStartedToday:1,cycleEndedToday:0,note:'secret',userId:'secret-id'},weather:{pressureMmHg:750,latitude:55.123456}}}
 const source={getName:()=> 'calm_risk_pipeline_test_source',risk_model_consent_policy:collection([policy]),users:collection([{_id:'u1'}]),
   risk_model_participation:collection([{userId:'u1',participating:true,consentVersion:policy.version,consentDigest:policy.digest}]),daily_questionnaires:collection([entry])}
 const destination={survey_training_examples:collection([{generation:'old'}]),survey_export_metadata:collection([])}
 const context={db:source,Mongo:class {getDB(){return destination}},require:()=>crypto,Buffer,Date,print(){},process:{env:{
   CALM_RISK_TRAINING_TEST_MODE:'YES',CALM_TRAINING_MONGO_URI:'mongodb://localhost/calm_risk_pipeline_test_training',
   CALM_TRAINING_HMAC_KEY:'long-test-secret-for-survey-not-for-real-use',CALM_TRAINING_REBUILD_CONFIRM:'YES',CALM_RISK_CONSENT_VERSION:policy.version,CALM_RISK_CONSENT_DIGEST:policy.digest}}}
 return {entry,source,destination,context}
}
test('separate morning export preserves horizon and zero stress without private diary fields',()=>{
 const f=setup();runInNewContext(script,f.context);const r=f.destination.survey_training_examples.rows[0]
 assert.equal(r.trainingEligible,true);assert.equal(r.featureSchemaVersion,5);assert.equal(r.features.stress,0);assert.equal(r.features.sleepMinutes,480)
 assert.equal(r.features.cycleStartedToday,1)
 assert.equal(r.features.cycleEndedToday,0)
 assert.equal(r.features.alcoholYesterday,1)
 assert.equal(r.issuedAt.toISOString(),'2026-01-01T09:00:00.000Z')
 for(const secret of ['secret','55.123456','"userId"']) assert.equal(JSON.stringify(r).includes(secret),false)
})
test('old cycle-answer semantics are excluded from the new export protocol',()=>{
 const f=setup();f.entry.prediction.protocol='after-survey-local-day-v1';runInNewContext(script,f.context)
 assert.equal(f.destination.survey_training_examples.rows.length,0)
})
test('older survey snapshots without alcohol remain exportable with unknown exposure',()=>{
 const f=setup();delete f.entry.prediction.features.alcoholYesterday;runInNewContext(script,f.context)
 assert.equal(f.destination.survey_training_examples.rows[0].features.alcoholYesterday,null)
})
test('older survey snapshots without cycle end remain exportable with unknown cycle end',()=>{
 const f=setup();delete f.entry.prediction.features.cycleEndedToday;runInNewContext(script,f.context)
 assert.equal(f.destination.survey_training_examples.rows[0].features.cycleEndedToday,null)
})
test('unknown, unfinished and invalid horizon are never training eligible',()=>{
 for(const mutate of [f=>f.entry.outcome=null,f=>f.entry.horizonCompleted=false,f=>f.entry.prediction.endAt=f.entry.prediction.issuedAt]){
  const f=setup();mutate(f);runInNewContext(script,f.context);assert.equal(f.destination.survey_training_examples.rows[0].trainingEligible,false)
 }
})
test('withdrawal, blocking, stale capture consent and deleted accounts remove rows on rebuild',()=>{
 for(const mutate of [f=>f.source.risk_model_participation.rows[0].participating=false,f=>f.source.risk_model_participation.rows[0].adminBlocked=true,
 f=>f.entry.prediction.consentVersion='old-consent',f=>f.source.users.rows.length=0]){
  const f=setup();runInNewContext(script,f.context);mutate(f);runInNewContext(script,f.context);assert.equal(f.destination.survey_training_examples.rows.length,0)
 }
})
test('late outcome correction republishes the same frozen input once',()=>{
 const f=setup();runInNewContext(script,f.context);f.entry.outcome=1;f.entry.labelHistory.push({});runInNewContext(script,f.context)
 const r=f.destination.survey_training_examples.rows[0];assert.equal(r.outcome,1);assert.equal(r.labelRevision,2);assert.equal(r.features.sleepMinutes,480)
 assert.equal(f.destination.survey_training_examples.rows.length,1)
})
