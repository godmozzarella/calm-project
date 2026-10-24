#!/bin/sh
set -eu

: "${CALM_TRAINING_SOURCE_URI:?Set read-only source URI}"
: "${CALM_TRAINING_MONGO_URI:?Set training writer URI}"
: "${CALM_TRAINING_HMAC_KEY:?Set stable HMAC secret}"
: "${CALM_RISK_CONSENT_VERSION:?Set approved consent version}"
: "${CALM_RISK_CONSENT_DIGEST:?Set approved consent text digest}"
if [ "${CALM_TRAINING_REBUILD_CONFIRM:-}" != YES ]; then
  echo 'Set CALM_TRAINING_REBUILD_CONFIRM=YES' >&2
  exit 1
fi

interval="${CALM_TRAINING_INTERVAL_SECONDS:-300}"
case "$interval" in
  ''|*[!0-9]*) echo 'CALM_TRAINING_INTERVAL_SECONDS must be a positive integer' >&2; exit 1 ;;
esac
if [ "$interval" -lt 2 ] || [ "$interval" -gt 3600 ]; then
  echo 'CALM_TRAINING_INTERVAL_SECONDS must be between 2 and 3600' >&2
  exit 1
fi
run_timeout="${CALM_TRAINING_RUN_TIMEOUT_SECONDS:-180}"
case "$run_timeout" in
  ''|*[!0-9]*) echo 'CALM_TRAINING_RUN_TIMEOUT_SECONDS must be a positive integer' >&2; exit 1 ;;
esac
if [ "$run_timeout" -lt 30 ] || [ "$run_timeout" -gt 3600 ]; then
  echo 'CALM_TRAINING_RUN_TIMEOUT_SECONDS must be between 30 and 3600' >&2
  exit 1
fi
command -v timeout >/dev/null 2>&1 || { echo 'timeout command is required' >&2; exit 1; }

rm -f /tmp/calm-risk-last-success

while :; do
  # Any failure exits the process; Compose restarts it, and health stays non-green.
  timeout "$run_timeout" mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /scripts/export-shared-risk-training.js
  export_dir="${CALM_TRAINING_EXPORT_DIR:-/exports}"
  mkdir -p "$export_dir"
  export_tmp="$export_dir/shared-risk-training.csv.tmp"
  if timeout "$run_timeout" mongosh --quiet "$CALM_TRAINING_MONGO_URI" \
      --file /scripts/export-shared-risk-training-csv.js > "$export_tmp"; then
    chmod 600 "$export_tmp"
    mv -f "$export_tmp" "$export_dir/shared-risk-training.csv"
  else
    rm -f "$export_tmp"
    echo 'CSV snapshot export failed; MongoDB training snapshot remains available' >&2
  fi
  date +%s > /tmp/calm-risk-last-success
  sleep "$interval"
done
