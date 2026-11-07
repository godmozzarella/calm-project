// mongosh against calm. One row per actual post-survey prediction; no mixing with midnight v4.
(() => {
  const test = process.env.CALM_RISK_TRAINING_TEST_MODE === 'YES'
  const source = test ? 'calm_risk_pipeline_test_source' : 'calm'
  const destination = test ? 'calm_risk_pipeline_test_training' : 'calm_risk_training'
  const uri = process.env.CALM_TRAINING_MONGO_URI, secret = process.env.CALM_TRAINING_HMAC_KEY
  if (db.getName() !== source || !uri?.split('?')[0].endsWith(`/${destination}`) || !secret ||
      Buffer.byteLength(secret, 'utf8') < 32 || process.env.CALM_TRAINING_REBUILD_CONFIRM !== 'YES') throw new Error('Invalid survey export configuration')
  const policy = db.risk_model_consent_policy.findOne({ _id: 'current' })
  if (!policy || policy.version !== process.env.CALM_RISK_CONSENT_VERSION || policy.digest !== process.env.CALM_RISK_CONSENT_DIGEST) throw new Error('Consent policy mismatch')
  const crypto = require('crypto')
  const hmac = value => crypto.createHmac('sha256', secret).update(value,'utf8').digest('hex')
  const accounts = new Set(db.users.find({},{_id:1}).toArray().map(u=>String(u._id)))
  const ids = db.risk_model_participation.find({ participating:true,adminBlocked:{$ne:true},consentVersion:policy.version,consentDigest:policy.digest }).toArray().map(p=>p.userId).filter(id=>accounts.has(id))
  const featureNames = ['sleepMinutes','sleepQuality','stress','newStartYesterday','newStartBeforeSurveyToday','ongoingAtIssue','medicationYesterday','alcoholYesterday','sex','age','cycleStartedToday','cycleEndedToday','cycleDay','hourLocal','horizonHours','episodeStartsLast3Days','episodeStartsLast7Days','episodeStartsLast14Days','episodeStartsLast30Days','episodeStartsLast90Days','daysSinceLastAttackStart','medicationDaysLast7Days']
  const weatherNames = ['provider','fetchedAt','stale','pressureMmHg','pressureDelta24hMmHg','humidity','humidityDelta24h','tempMin','tempMax','windKmhMax','kpIndex','unavailable']
  const pick = (object, names) => Object.fromEntries(names.map(k=>{
    const v=object?.[k]; return [k,v==null || typeof v==='number' || typeof v==='string' || typeof v==='boolean' || v instanceof Date ? v??null : null]
  }))
  const now = new Date(), generation = `${now.toISOString().replace(/[-:.TZ]/g,'')}_${crypto.randomBytes(8).toString('hex')}`
  const rows = []
  for(const entry of db.daily_questionnaires.find({userId:{$in:ids}}).toArray()) {
    const p=entry.prediction
    if(p?.schemaVersion!==5 || p.protocol!=='after-survey-local-day-v2' || p.consentVersion!==policy.version || p.consentDigest!==policy.digest) continue
    const start=new Date(p.issuedAt),end=new Date(p.endAt)
    const valid=Number.isFinite(+start) && Number.isFinite(+end) && end>start && end-start<=25*3600000
    const known=entry.outcome===0 || entry.outcome===1
    rows.push({_id:hmac(`${entry.userId}|${entry.date}|${p.issuedAt}`)+'_'+generation,generation,
      participantKey:hmac(entry.userId),targetDate:entry.date,timezone:entry.timezone,
      featureSchemaVersion:5,protocolVersion:p.protocol,targetVersion:'new-attack-onset-after-survey-v1',
      issuedAt:p.issuedAt,targetStartAt:p.issuedAt,targetEndAt:p.endAt,
      features:pick(p.features,featureNames),weatherForecast:pick(p.weather,weatherNames),
      outcome:known?entry.outcome:null,horizonCompleted:entry.horizonCompleted===true,
      labelRevision:entry.labelHistory?.length??0,
      trainingEligible:valid && end<=now && entry.horizonCompleted===true && known,
      consentVersion:policy.version,consentDigest:policy.digest})
  }
  const training=new Mongo(uri).getDB(destination)
  if(rows.length) training.survey_training_examples.insertMany(rows,{ordered:false})
  if(training.survey_training_examples.countDocuments({generation})!==rows.length) throw new Error('Incomplete survey export generation')
  training.survey_export_metadata.replaceOne({_id:'active'},{_id:'active',generation,generatedAt:now,
    featureSchemaVersion:5,protocolVersion:'after-survey-local-day-v2',targetVersion:'new-attack-onset-after-survey-v1',
    consentVersion:policy.version,consentDigest:policy.digest,exampleCount:rows.length,
    trainingEligibleCount:rows.filter(r=>r.trainingEligible).length},{upsert:true})
  training.survey_training_examples.deleteMany({generation:{$ne:generation}})
  print(`Published ${rows.length} survey v5 predictions; ${rows.filter(r=>r.trainingEligible).length} eligible`)
})()
