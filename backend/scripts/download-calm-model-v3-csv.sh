#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export_script="$script_dir/export-calm-model-v3-with-userid.js"
ssh_key="$HOME/.ssh/calm_vps_ed25519"
download_dir="$HOME/Downloads"
dataset="${CALM_CSV_DATASET:-diary-v3}"
case "$dataset" in
  diary-v3) output="$download_dir/calm-model-v3-with-userid.csv" ;;
  survey-v5) output="$download_dir/calm-survey-v5-with-userid.csv" ;;
  onset-v4) output="$download_dir/calm-onset-v4-with-userid.csv" ;;
  *) printf 'Unsupported dataset\n' >&2; exit 1 ;;
esac

if [[ ! -f "$ssh_key" ]]; then
  printf 'SSH key not found: %s\n' "$ssh_key" >&2
  exit 1
fi
if [[ ! -d "$download_dir" ]]; then
  printf 'Downloads folder not found: %s\n' "$download_dir" >&2
  exit 1
fi

umask 077
csv_tmp="$(mktemp "$download_dir/.calm-model-v3-XXXXXX")"
trap 'rm -f "$csv_tmp"' EXIT

ssh -i "$ssh_key" -o IdentitiesOnly=yes -T \
  calmadmin@193.23.195.216 \
  "cd /opt/calm-project && docker compose -f docker-compose.yml -f docker-compose.auth.yml -f docker-compose.prod.yml -f docker-compose.training-worker-v3.yml exec -T -e CALM_CSV_DATASET=$dataset training-worker sh -c 'mongosh --quiet \"\$CALM_TRAINING_SOURCE_URI\" --file /dev/stdin'" \
  < "$export_script" > "$csv_tmp"

if [[ "$(head -n 1 "$csv_tmp")" != '"userId","targetDate","y",'* ]]; then
  printf 'CSV export returned an unexpected header; previous file was kept.\n' >&2
  exit 1
fi

chmod 600 "$csv_tmp"
mv -f "$csv_tmp" "$output"
printf 'Saved %s (%s data rows)\n' "$output" "$(($(wc -l < "$output") - 1))"
