#!/usr/bin/env bash
# Disposable MongoDB integration test. Does not connect to the Calm database.
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"
compose=(docker compose -p calm-risk-v3-test -f backend/scripts/compose.shared-risk-auth-test.yml)
trap '"${compose[@]}" down' EXIT

"${compose[@]}" up -d --wait
"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  admin --file /dev/stdin < backend/scripts/setup-shared-risk-auth-test.js
"${compose[@]}" exec -T -e CALM_RISK_TRAINING_TEST_MODE=YES mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/seed-shared-risk-v3-test.js

export_args=(
  -e CALM_RISK_TRAINING_TEST_MODE=YES
  -e 'CALM_TRAINING_MONGO_URI=mongodb://risk_test_training_writer:risk-test-training-only-password@localhost:27017/calm_risk_pipeline_test_training?authSource=admin'
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production
  -e CALM_TRAINING_REBUILD_CONFIRM=YES
)
verify_args=(
  -e CALM_RISK_TRAINING_TEST_MODE=YES
  -e 'CALM_TRAINING_MONGO_URI=mongodb://risk_test_training_writer:risk-test-training-only-password@localhost:27017/calm_risk_pipeline_test_training?authSource=admin'
)
"${compose[@]}" exec -T "${export_args[@]}" mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/export-shared-risk-training-v3.js
"${compose[@]}" exec -T "${verify_args[@]}" mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/verify-shared-risk-v3-test.js

"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --eval \
  'db.risk_model_participation.updateOne({_id:"v3-participant"},{$set:{participating:false}})'
"${compose[@]}" exec -T "${export_args[@]}" mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/export-shared-risk-training-v3.js
"${compose[@]}" exec -T "${verify_args[@]}" -e CALM_RISK_PIPELINE_TEST_REVOKED=YES mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/verify-shared-risk-v3-test.js
