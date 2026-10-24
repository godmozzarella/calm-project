#!/bin/sh
# Read-only preflight for the production risk-data collector. Prints no secret values.
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$project_dir"

for required in \
  docker-compose.yml docker-compose.auth.yml docker-compose.prod.yml docker-compose.training-worker-v3.yml \
  backend/scripts/export-shared-risk-training-v3.js backend/scripts/inspect-shared-risk-data.js \
  backend/scripts/validate-prod-training-config.py \
  backend/scripts/run-shared-risk-v3-export-loop.sh backend/scripts/health-shared-risk-export.sh \
  backend/src/main/java/com/calm/feature/risk/RiskTrainingInputScheduler.java \
  backend/src/main/java/com/calm/feature/risk/RiskTrainingInputSnapshot.java \
  backend/src/main/java/com/calm/feature/risk/RiskTrainingInputSnapshotRepository.java \
  backend/src/main/java/com/calm/feature/risk/TrainingHistoryDetails.java; do
  if [ ! -f "$required" ]; then
    echo "Missing release file: $required" >&2
    exit 1
  fi
done

for private_file in .env backend/.env backend/.env.training-worker; do
  if [ ! -f "$private_file" ]; then
    echo "Missing private configuration: $private_file" >&2
    exit 1
  fi
  mode=$(python3 -c 'import os,stat,sys; print(oct(stat.S_IMODE(os.stat(sys.argv[1]).st_mode))[2:])' "$private_file")
  case "$mode" in
    600|400) ;;
    *) echo "Private configuration must be owner-only (600 or 400): $private_file" >&2; exit 1 ;;
  esac
done

require_env() {
  file=$1
  key=$2
  if ! awk -F= -v required_key="$key" '
    $1 == required_key {
      value = substr($0, index($0, "=") + 1)
      if (value != "" && value !~ /REPLACE|YOUR_|CHANGEME/) found = 1
    }
    END { exit !found }
  ' "$file"; then
    echo "Missing or placeholder setting: $key in $file" >&2
    exit 1
  fi
}

require_env .env CALM_MONGO_URI
require_env backend/.env CALM_RISK_PILOT_APPROVED_CONSENT_VERSION
require_env backend/.env CALM_RISK_PILOT_APPROVED_CONSENT_DIGEST
require_env backend/.env.training-worker CALM_TRAINING_SOURCE_URI
require_env backend/.env.training-worker CALM_TRAINING_MONGO_URI
require_env backend/.env.training-worker CALM_TRAINING_HMAC_KEY
require_env backend/.env.training-worker CALM_RISK_CONSENT_VERSION
require_env backend/.env.training-worker CALM_RISK_CONSENT_DIGEST

compose() {
  docker compose -f docker-compose.yml -f docker-compose.auth.yml \
    -f docker-compose.prod.yml -f docker-compose.training-worker-v3.yml "$@"
}

compose config --quiet
compose config --format json | python3 backend/scripts/validate-prod-training-config.py

if [ "${1:-}" = '--release' ]; then
  if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
    echo 'Working tree is not clean; release files may not be in the deployed revision' >&2
    exit 1
  fi
fi

echo 'Production training configuration passes read-only preflight.'
