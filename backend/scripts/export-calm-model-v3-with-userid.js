// Run with mongosh against the source `calm` database. CSV includes account IDs
// and diary details; use only for the owner's local review.
const crypto = require('crypto');
const training = new Mongo(process.env.CALM_TRAINING_MONGO_URI)
  .getDB('calm_risk_training');

const survey = process.env.CALM_CSV_DATASET === 'survey-v5';
const onset = process.env.CALM_CSV_DATASET === 'onset-v4';
const metadata = (survey ? training.survey_export_metadata : onset ? training.onset_export_metadata : training.export_metadata).findOne({_id: 'active'});
if (!metadata) throw new Error('No published training dataset');

const idByKey = new Map();
for (const user of db.users.find({}, {_id: 1})) {
  const userId = String(user._id);
  const key = crypto.createHmac('sha256', process.env.CALM_TRAINING_HMAC_KEY)
    .update(userId, 'utf8').digest('hex');
  idByKey.set(key, userId);
}

const rows = (survey ? training.survey_training_examples : onset ? training.onset_training_examples : training.training_examples)
  .find({generation: metadata.generation})
  .sort({targetDate: 1, participantKey: 1}).toArray();

if (rows.length !== metadata.exampleCount) {
  throw new Error('Dataset generation changed while reading; retry the export');
}

function flatten(value, path, result) {
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, `${path}.${key}`, result);
    }
  } else {
    result[path] = value;
  }
}

const table = rows.map(row => {
  const userId = idByKey.get(row.participantKey);
  if (!userId) throw new Error('No account ID found for a dataset row');

  const result = {userId, y: row.outcome};
  for (const [key, value] of Object.entries(row)) {
    if (key !== '_id' && key !== 'outcome') flatten(value, key, result);
  }
  result.exportGeneratedAt = metadata.generatedAt;
  result.detailSchemaVersion = metadata.detailSchemaVersion;
  return result;
});

const first = survey ? ['userId', 'targetDate', 'y', 'issuedAt', 'targetEndAt', 'trainingEligible'] : onset ? ['userId', 'targetDate', 'y', 'labelSource', 'trainingEligible']
  : ['userId', 'targetDate', 'y', 'attackCount'];
const remaining = [...new Set(table.flatMap(row => Object.keys(row)))]
  .filter(key => !first.includes(key)).sort();
const columns = [...first, ...remaining];

function csv(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString()
    : typeof value === 'object' ? EJSON.stringify(value) : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

print(columns.map(csv).join(','));
for (const row of table) {
  print(columns.map(column => csv(row[column])).join(','));
}
