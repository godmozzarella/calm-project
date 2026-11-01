#!/usr/bin/env bash
set -euo pipefail

target_sha=${1:?Expected release commit SHA}
[[ "$target_sha" =~ ^[a-f0-9]{40}$ ]] || exit 1

if [[ "$(git branch --show-current)" != main ]]; then
  echo 'Server checkout must be on main.' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo 'Server checkout contains local changes; refusing to deploy.' >&2
  exit 1
fi
previous_sha=$(git rev-parse HEAD)

git fetch origin main
git merge-base --is-ancestor "$target_sha" origin/main || {
  echo 'Selected commit is absent from origin/main.' >&2
  exit 1
}
git merge-base --is-ancestor HEAD "$target_sha" || {
  echo 'Selected commit is older than the deployed checkout.' >&2
  exit 1
}

git merge --ff-only "$target_sha"
sh backend/scripts/check-prod-training-readiness.sh --release

compose=(docker compose -f docker-compose.yml -f docker-compose.auth.yml
  -f docker-compose.prod.yml -f docker-compose.training-worker-v3.yml)
previous_backend=$("${compose[@]}" ps -aq backend)
previous_frontend=$("${compose[@]}" ps -aq frontend)
previous_backend_image=''
previous_frontend_image=''
if [[ -n "$previous_backend" && -n "$previous_frontend" ]]; then
  previous_backend_image=$(docker inspect --format '{{.Image}}' "$previous_backend")
  previous_frontend_image=$(docker inspect --format '{{.Image}}' "$previous_frontend")
fi
# Preserve old images under valid local references before the build replaces :latest.
rollback_backend_image="calm-release-rollback-backend:$target_sha"
rollback_frontend_image="calm-release-rollback-frontend:$target_sha"
if [[ -n "$previous_backend_image" && -n "$previous_frontend_image" ]]; then
  docker image tag "$previous_backend_image" "$rollback_backend_image"
  docker image tag "$previous_frontend_image" "$rollback_frontend_image"
fi
# Build before stopping writers to keep the backup window short.
"${compose[@]}" build backend frontend
umask 077
mkdir -p "$PWD/.release-backups"
backup_dir="$(mktemp -d "$PWD/.release-backups/$(date -u '+%Y%m%dT%H%M%SZ')-$target_sha-XXXXXX")"
printf '%s\n' "$previous_sha" > "$backup_dir/deployed-before-sha"
if [[ -n "$previous_backend_image" && -n "$previous_frontend_image" ]]; then
  printf 'services:\n  backend:\n    image: "%s"\n  frontend:\n    image: "%s"\n' \
    "$rollback_backend_image" "$rollback_frontend_image" > "$backup_dir/rollback-images.yml"
fi
writers_stopped=false
resume_on_failure() {
  result=$?
  trap - EXIT
  if [[ "$writers_stopped" == true ]]; then
    if [[ -f "$backup_dir/rollback-images.yml" ]]; then
      "${compose[@]}" stop backend frontend training-worker || true
      if "${compose[@]}" -f "$backup_dir/rollback-images.yml" up -d --no-deps --no-build backend frontend; then
        echo 'Previous backend/frontend images restored; source volumes preserved.' >&2
      else
        echo 'Rollback image recreation failed; trying to start the existing backend/frontend containers.' >&2
        if "${compose[@]}" start backend frontend; then
          echo 'Existing backend/frontend containers started as a recovery fallback.' >&2
        else
          echo "Automatic image recovery failed; use $backup_dir/rollback-images.yml" >&2
        fi
      fi
      "${compose[@]}" start training-worker || true
    else
      "${compose[@]}" start backend frontend training-worker || true
    fi
  fi
  exit "$result"
}
trap resume_on_failure EXIT
writers_stopped=true
"${compose[@]}" stop backend training-worker
"${compose[@]}" run --rm --no-deps --entrypoint /bin/sh training-worker -c \
  'mongodump --quiet --uri "$CALM_TRAINING_SOURCE_URI" --archive --gzip' > "$backup_dir/calm.archive.gz"
gzip -t "$backup_dir/calm.archive.gz"
"${compose[@]}" run --rm --no-deps --entrypoint tar backend \
  -C /app/uploads/avatars -czf - . > "$backup_dir/avatars.tar.gz"
tar -tzf "$backup_dir/avatars.tar.gz" > /dev/null
sha256sum "$backup_dir/calm.archive.gz" "$backup_dir/avatars.tar.gz" > "$backup_dir/SHA256SUMS"
printf '%s\n' "$target_sha" > "$backup_dir/release-sha"
"${compose[@]}" run --rm -T --no-deps --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /dev/stdin' \
  < backend/scripts/release-source-manifest.js > "$backup_dir/source-before.json"
# The worker source account stays read-only. Only this backed-up migration uses the app write URI.
CALM_BACKFILL_SOURCE_URI=$("${compose[@]}" run --rm -T --no-deps --entrypoint printenv backend MONGO_URI)
test -n "$CALM_BACKFILL_SOURCE_URI"
export CALM_BACKFILL_SOURCE_URI
"${compose[@]}" run --rm -T --no-deps -e CALM_BACKFILL_SOURCE_URI --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_BACKFILL_SOURCE_URI" --file /dev/stdin' < backend/scripts/backfill-event-locations.js
unset CALM_BACKFILL_SOURCE_URI
"${compose[@]}" run --rm -T --no-deps --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /dev/stdin' \
  < backend/scripts/release-source-manifest.js > "$backup_dir/source-after.json"
cmp "$backup_dir/source-before.json" "$backup_dir/source-after.json"
"${compose[@]}" up -d --no-deps --wait --wait-timeout 300 backend frontend caddy
# Rebuild the existing dataset from all historical diary entries before starting the loop.
"${compose[@]}" run --rm -T --no-deps --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /scripts/export-shared-risk-training.js'
"${compose[@]}" up -d --no-deps --wait --wait-timeout 300 training-worker
"${compose[@]}" exec -T backend wget -qO- http://localhost:8080/api/actuator/health
"${compose[@]}" ps
writers_stopped=false
trap - EXIT
echo "Deployed commit $(git rev-parse HEAD)"
