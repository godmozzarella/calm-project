#!/bin/sh
# Runtime smoke for v4/v5 exporters in the same mongosh image as production.
# Runs only against an isolated synthetic MongoDB inside this disposable container.
set -eu

mkdir -p /tmp/calm-export-smoke-db
mongod --fork --quiet --bind_ip 127.0.0.1 --dbpath /tmp/calm-export-smoke-db --logpath /tmp/calm-export-smoke-mongo.log

export CALM_RISK_TRAINING_TEST_MODE=YES
export CALM_TRAINING_SOURCE_URI=mongodb://127.0.0.1:27017/calm_risk_pipeline_test_source
export CALM_TRAINING_MONGO_URI=mongodb://127.0.0.1:27017/calm_risk_pipeline_test_training
export CALM_TRAINING_HMAC_KEY=isolated-mongosh-smoke-test-secret-00000000
export CALM_TRAINING_REBUILD_CONFIRM=YES
export CALM_RISK_CONSENT_VERSION=test-consent
export CALM_RISK_CONSENT_DIGEST=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --eval 'db.risk_model_consent_policy.insertOne({_id:"current",version:"test-consent",digest:"a".repeat(64)})' >/dev/null
mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /scripts/export-shared-risk-onset-v4.js
mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /scripts/export-shared-risk-survey-v5.js
mongosh --quiet "$CALM_TRAINING_MONGO_URI" --eval 'const onset=db.onset_export_metadata.findOne({_id:"active"}); const survey=db.survey_export_metadata.findOne({_id:"active"}); if(!onset||!survey||onset.exampleCount!==0||survey.exampleCount!==0) throw new Error("Missing smoke metadata"); print("mongosh exporter smoke passed")'
