#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

base=(docker compose -p calm-risk-migration-test -f backend/scripts/compose.shared-risk-migration-test.yml)
auth=(docker compose -p calm-risk-migration-test -f backend/scripts/compose.shared-risk-migration-test.yml \
  -f backend/scripts/compose.shared-risk-migration-auth.yml)
trap '"${auth[@]}" down -v' EXIT

"${base[@]}" up -d --wait
"${base[@]}" exec -T mongo mongosh --quiet calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/seed-shared-risk-pipeline-test.js
"${base[@]}" exec -T \
  -e CALM_MONGO_SETUP_TEST_MODE=YES -e CALM_MONGO_SETUP_CONFIRM=YES \
  -e CALM_MONGO_ROOT_PASSWORD=risk-migration-root-test-only-2026-very-long \
  -e CALM_MONGO_APP_PASSWORD=risk-migration-app-test-only-2026-very-long \
  -e CALM_MONGO_EXPORT_PASSWORD=risk-migration-export-test-only-2026-very-long \
  -e CALM_MONGO_TRAINING_PASSWORD=risk-migration-train-test-only-2026-very-long \
  mongo mongosh --quiet admin --file /dev/stdin \
  < backend/scripts/prepare-shared-risk-mongo-users.js

# Recreate only the disposable MongoDB container; its named test volume persists.
"${auth[@]}" up -d --force-recreate --no-deps --wait mongo
"${auth[@]}" exec -T mongo mongosh --quiet \
  --username calm_app --password risk-migration-app-test-only-2026-very-long --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/verify-shared-risk-migration-app.js
"${auth[@]}" exec -T -e CALM_RISK_AUTH_TEST_ACCOUNT=source mongo mongosh --quiet \
  --username calm_risk_export_reader --password risk-migration-export-test-only-2026-very-long \
  --authenticationDatabase admin calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/verify-shared-risk-auth-test.js
"${auth[@]}" exec -T -e CALM_RISK_AUTH_TEST_ACCOUNT=training mongo mongosh --quiet \
  --username calm_risk_training_writer --password risk-migration-train-test-only-2026-very-long \
  --authenticationDatabase admin calm_risk_pipeline_test_training --file /dev/stdin \
  < backend/scripts/verify-shared-risk-auth-test.js

"${auth[@]}" up -d --wait training-worker

"${auth[@]}" exec -T \
  -e 'CALM_TRAINING_MONGO_URI=mongodb://calm_risk_training_writer:risk-migration-train-test-only-2026-very-long@localhost:27017/calm_risk_pipeline_test_training?authSource=admin' \
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production \
  mongo mongosh --quiet --username calm_risk_export_reader \
  --password risk-migration-export-test-only-2026-very-long --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/verify-shared-risk-pipeline-test.js

# Exercise the real Spring Boot connection and an authenticated database write.
"${auth[@]}" up -d --build --wait backend
registration_json="$(curl --silent --show-error --fail \
  --header 'Content-Type: application/json' \
  --data '{"email":"migration-pilot@example.test","name":"Migration Pilot","password":"test-password-only"}' \
  http://127.0.0.1:18081/api/auth/register)"
test_user_id="$(printf '%s' "$registration_json" | jq -er '.user.id')"
test_token="$(printf '%s' "$registration_json" | jq -er '.token')"
unset registration_json

"${auth[@]}" exec -T -e "CALM_RISK_DELETE_TEST_USER_ID=$test_user_id" mongo mongosh --quiet \
  --username calm_app --password risk-migration-app-test-only-2026-very-long --authenticationDatabase admin \
  calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/seed-shared-risk-deletion-test.js

rebuild_seen=false
for attempt in $(seq 1 30); do
  if "${auth[@]}" exec -T -e "CALM_RISK_DELETE_TEST_USER_ID=$test_user_id" \
    -e CALM_RISK_DELETE_TEST_STAGE=before \
    -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production \
    mongo mongosh --quiet --username calm_risk_admin --password risk-migration-root-test-only-2026-very-long \
    --authenticationDatabase admin calm_risk_pipeline_test_source --file /dev/stdin \
    < backend/scripts/verify-shared-risk-deletion-test.js >/dev/null 2>&1; then
    rebuild_seen=true
    break
  fi
  sleep 1
done
if [ "$rebuild_seen" != true ]; then
  echo 'Scheduled training rebuild did not include the test account within 30 attempts' >&2
  exit 1
fi
"${auth[@]}" exec -T -e "CALM_RISK_DELETE_TEST_USER_ID=$test_user_id" \
  -e CALM_RISK_DELETE_TEST_STAGE=before \
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production \
  mongo mongosh --quiet --username calm_risk_admin --password risk-migration-root-test-only-2026-very-long \
  --authenticationDatabase admin calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/verify-shared-risk-deletion-test.js

delete_status="$(curl --silent --show-error --fail -o /dev/null -w '%{http_code}' \
  --request DELETE --header "Authorization: Bearer $test_token" \
  http://127.0.0.1:18081/api/users/me)"
unset test_token
if [[ "$delete_status" != 204 ]]; then
  printf 'Unexpected account deletion response: %s\n' "$delete_status" >&2
  exit 1
fi

rebuild_seen=false
for attempt in $(seq 1 30); do
  if "${auth[@]}" exec -T -e "CALM_RISK_DELETE_TEST_USER_ID=$test_user_id" \
    -e CALM_RISK_DELETE_TEST_STAGE=after \
    -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production \
    mongo mongosh --quiet --username calm_risk_admin --password risk-migration-root-test-only-2026-very-long \
    --authenticationDatabase admin calm_risk_pipeline_test_source --file /dev/stdin \
    < backend/scripts/verify-shared-risk-deletion-test.js >/dev/null 2>&1; then
    rebuild_seen=true
    break
  fi
  sleep 1
done
if [ "$rebuild_seen" != true ]; then
  echo 'Scheduled training rebuild did not remove the deleted account within 30 attempts' >&2
  exit 1
fi
"${auth[@]}" stop training-worker
"${auth[@]}" exec -T -e "CALM_RISK_DELETE_TEST_USER_ID=$test_user_id" \
  -e CALM_RISK_DELETE_TEST_STAGE=after \
  -e CALM_TRAINING_HMAC_KEY=integration-only-secret-2026-keep-out-of-production \
  mongo mongosh --quiet --username calm_risk_admin --password risk-migration-root-test-only-2026-very-long \
  --authenticationDatabase admin calm_risk_pipeline_test_source --file /dev/stdin \
  < backend/scripts/verify-shared-risk-deletion-test.js
