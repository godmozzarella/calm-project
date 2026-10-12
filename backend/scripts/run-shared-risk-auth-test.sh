#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

compose=(docker compose -p calm-risk-auth-test -f backend/scripts/compose.shared-risk-auth-test.yml)
trap '"${compose[@]}" down' EXIT

"${compose[@]}" up -d --wait
"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  admin --file /dev/stdin < backend/scripts/setup-shared-risk-auth-test.js
"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/seed-shared-risk-pipeline-test.js

# Keep the dump in container tmpfs; restore into a different synthetic database.
"${compose[@]}" exec -T mongo mongodump --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  --db calm_risk_pipeline_test_source --archive=/data/db/risk-test.archive
"${compose[@]}" exec -T mongo mongorestore --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  --archive=/data/db/risk-test.archive \
  '--nsFrom=calm_risk_pipeline_test_source.*' '--nsTo=calm_risk_pipeline_test_restored.*'
"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/verify-shared-risk-restore-test.js

"${compose[@]}" exec -T -e CALM_RISK_AUTH_TEST_ACCOUNT=source mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/verify-shared-risk-auth-test.js
"${compose[@]}" exec -T -e CALM_RISK_AUTH_TEST_ACCOUNT=training mongo mongosh --quiet \
  --username risk_test_training_writer --password risk-test-training-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_training --file /dev/stdin < backend/scripts/verify-shared-risk-auth-test.js

export_args=(
  -e CALM_RISK_TRAINING_TEST_MODE=YES
  -e 'CALM_TRAINING_MONGO_URI=mongodb://risk_test_training_writer:risk-test-training-only-password@localhost:27017/calm_risk_pipeline_test_training?authSource=admin'
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production
  -e CALM_TRAINING_REBUILD_CONFIRM=YES
)
verify_args=(
  -e 'CALM_TRAINING_MONGO_URI=mongodb://risk_test_training_writer:risk-test-training-only-password@localhost:27017/calm_risk_pipeline_test_training?authSource=admin'
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production
)

"${compose[@]}" exec -T "${export_args[@]}" mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/export-shared-risk-training.js
"${compose[@]}" exec -T "${verify_args[@]}" mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/verify-shared-risk-pipeline-test.js
"${compose[@]}" exec -T -e CALM_RISK_TRAINING_TEST_MODE=YES \
  -e 'CALM_TRAINING_SOURCE_URI=mongodb://risk_test_source_reader:risk-test-source-only-password@localhost:27017/calm_risk_pipeline_test_source?authSource=admin' \
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production \
  mongo mongosh --quiet \
  --username risk_test_training_writer --password risk-test-training-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_training --file /dev/stdin < backend/scripts/evaluate-shared-risk-model.js

"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/revoke-shared-risk-pipeline-test.js
"${compose[@]}" exec -T "${export_args[@]}" mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/export-shared-risk-training.js
"${compose[@]}" exec -T "${verify_args[@]}" -e CALM_RISK_PIPELINE_TEST_REVOKED=YES mongo mongosh --quiet \
  --username risk_test_source_reader --password risk-test-source-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin < backend/scripts/verify-shared-risk-pipeline-test.js

# A pre-withdrawal backup still has old consent. Reset it before use and purge old model artifacts.
"${compose[@]}" exec -T -e CALM_RISK_RESTORE_TEST_MODE=YES -e CALM_RISK_RESTORE_RESET_CONFIRM=YES \
  mongo mongosh --quiet --username risk_test_root --password risk-test-root-only-password \
  --authenticationDatabase admin calm_risk_pipeline_test_restored --file /dev/stdin \
  < backend/scripts/reset-shared-model-consent-after-restore.js
"${compose[@]}" exec -T -e CALM_RISK_RESTORE_TEST_MODE=YES -e CALM_RISK_RESTORE_RESET_CONFIRM=YES \
  mongo mongosh --quiet --username risk_test_root --password risk-test-root-only-password \
  --authenticationDatabase admin calm_risk_pipeline_test_training --file /dev/stdin \
  < backend/scripts/purge-shared-risk-training-after-restore.js
"${compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm_risk_pipeline_test_restored --file /dev/stdin < backend/scripts/verify-shared-risk-recovery-test.js
