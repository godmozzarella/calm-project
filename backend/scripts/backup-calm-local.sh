#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repository_root"

backup_root="${1:?Usage: bash backend/scripts/backup-calm-local.sh /absolute/backup/directory}"
if [[ "$backup_root" != /* || -L "$backup_root" ]]; then
  echo "Backup directory must be an absolute path and not a symlink" >&2
  exit 1
fi

umask 077
mkdir -p "$backup_root"
chmod 700 "$backup_root"
backup_dir="$backup_root/$(date '+%Y-%m-%dT%H%M%S%z')"
mkdir -m 700 "$backup_dir"
printf 'Backup incomplete\n' > "$backup_dir/INCOMPLETE"

compose=(docker compose)
verify_compose=(docker compose -p "calm-backup-verify-$(date '+%Y%m%d%H%M%S')" -f backend/scripts/compose.shared-risk-auth-test.yml)
backend_was_running=false
verify_started=false

cleanup() {
  result=$?
  trap - EXIT
  if [[ "$verify_started" == true ]]; then
    "${verify_compose[@]}" down || result=1
  fi
  if [[ "$backend_was_running" == true ]]; then
    "${compose[@]}" start backend || result=1
  fi
  if [[ "$result" -ne 0 ]]; then
    echo "Backup did not finish; inspect $backup_dir/INCOMPLETE" >&2
  fi
  exit "$result"
}
trap cleanup EXIT

running_services="$("${compose[@]}" ps --services --status running)"
if ! rg -qx 'mongo' <<< "$running_services" || ! rg -qx 'backend' <<< "$running_services"; then
  echo "The Calm mongo and backend services must be running" >&2
  exit 1
fi
backend_was_running=true
"${compose[@]}" stop backend

manifest_js='const hashes = db.runCommand({dbHash: 1}).collections; print(JSON.stringify({collections: db.getCollectionNames().sort().map(name => ({name, count: db.getCollection(name).countDocuments({}), indexes: db.getCollection(name).getIndexes().map(index => ({name: index.name, key: index.key, unique: index.unique ?? false})).sort((a, b) => a.name.localeCompare(b.name))})), hashes: Object.keys(hashes).sort().map(name => [name, hashes[name]])}))'
"${compose[@]}" exec -T mongo mongosh --quiet calm --eval "$manifest_js" > "$backup_dir/source-manifest.json"
"${compose[@]}" exec -T mongo mongodump --quiet --db calm --archive > "$backup_dir/calm.archive"
docker run --rm --entrypoint tar -v calm-project_avatars_data:/avatars:ro calm-project-backend \
  -C /avatars -cf - . > "$backup_dir/avatars.tar"
tar -tf "$backup_dir/avatars.tar" > /dev/null
tar -xOf "$backup_dir/avatars.tar" > /dev/null

verify_started=true
"${verify_compose[@]}" up -d --wait
"${verify_compose[@]}" exec -T mongo mongorestore --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  --archive < "$backup_dir/calm.archive"
"${verify_compose[@]}" exec -T mongo mongosh --quiet \
  --username risk_test_root --password risk-test-root-only-password --authenticationDatabase admin \
  calm --eval "$manifest_js" > "$backup_dir/restored-manifest.json"
cmp "$backup_dir/source-manifest.json" "$backup_dir/restored-manifest.json"

shasum -a 256 "$backup_dir/calm.archive" "$backup_dir/avatars.tar" > "$backup_dir/SHA256SUMS"
mv "$backup_dir/INCOMPLETE" "$backup_dir/COMPLETE"
printf 'Backup and isolated restore verified\n' > "$backup_dir/COMPLETE"
printf 'Local backup and isolated restore verified: %s\n' "$backup_dir"
