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
preserve_rollback_image() {
  local container_id=$1 image_id=$2 image_tag=$3 service=$4
  if ! docker image tag "$image_id" "$image_tag" 2>/dev/null; then
    # A container can outlive its image metadata. Export/import preserves its filesystem
    # without copying environment variables (which may contain credentials) into the image.
    local workdir='' entrypoint='' command='' user='' path='' environment='' safe_env=''
    local -a import_options=()
    workdir=$(docker inspect --format '{{.Config.WorkingDir}}' "$container_id")
    entrypoint=$(docker inspect --format '{{json .Config.Entrypoint}}' "$container_id")
    command=$(docker inspect --format '{{json .Config.Cmd}}' "$container_id")
    user=$(docker inspect --format '{{.Config.User}}' "$container_id")
    safe_env=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container_id" |
      awk -F= '$1 ~ /^(PATH|HOME|LANG|LC_ALL|TZ|JAVA_HOME|JAVA_VERSION|JAVA_RUNTIME_VERSION|JAVA_VENDOR|NGINX_VERSION|NJS_VERSION|NJS_RELEASE|PKG_RELEASE|DYNPKG_RELEASE)$/ { print }')
    while IFS= read -r environment; do
      [[ -z "$environment" ]] && continue
      import_options+=(--change "ENV $environment")
      [[ "$environment" == PATH=* ]] && path=${environment#PATH=}
    done <<< "$safe_env"
    if [[ -z "$path" ]]; then
      echo "Cannot preserve $service container: its PATH is unavailable." >&2
      return 1
    fi
    [[ -z "$workdir" ]] || import_options+=(--change "WORKDIR $workdir")
    [[ -z "$entrypoint" || "$entrypoint" == null || "$entrypoint" == '[]' ]] || import_options+=(--change "ENTRYPOINT $entrypoint")
    [[ -z "$command" || "$command" == null || "$command" == '[]' ]] || import_options+=(--change "CMD $command")
    [[ -z "$user" ]] || import_options+=(--change "USER $user")
    docker export "$container_id" | docker import "${import_options[@]}" - "$image_tag" >/dev/null
    echo "Captured existing $service filesystem as a credential-free rollback image." >&2
  fi
  docker image inspect "$image_tag" >/dev/null
}
if [[ -n "$previous_backend_image" && -n "$previous_frontend_image" ]]; then
  preserve_rollback_image "$previous_backend" "$previous_backend_image" "$rollback_backend_image" backend
  preserve_rollback_image "$previous_frontend" "$previous_frontend_image" "$rollback_frontend_image" frontend
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
deployment_phase='stopping writers'
resume_on_failure() {
  result=$?
  trap - EXIT
  if [[ "$writers_stopped" == true ]]; then
    # EOF or an early exit 0 is still a failed release until all checks finish.
    [[ "$result" != 0 ]] || result=1
    echo "Deployment aborted during '$deployment_phase' (exit=$result); restoring previous services." >&2
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
deployment_phase='MongoDB backup'
"${compose[@]}" run --rm --no-deps --entrypoint /bin/sh training-worker -c \
  'mongodump --quiet --uri "$CALM_TRAINING_SOURCE_URI" --archive --gzip' > "$backup_dir/calm.archive.gz"
gzip -t "$backup_dir/calm.archive.gz"
deployment_phase='avatar backup'
"${compose[@]}" run --rm --no-deps --entrypoint tar backend \
  -C /app/uploads/avatars -czf - . > "$backup_dir/avatars.tar.gz"
tar -tzf "$backup_dir/avatars.tar.gz" > /dev/null
sha256sum "$backup_dir/calm.archive.gz" "$backup_dir/avatars.tar.gz" > "$backup_dir/SHA256SUMS"
printf '%s\n' "$target_sha" > "$backup_dir/release-sha"
deployment_phase='source manifest before migration'
"${compose[@]}" run --rm -T --no-deps --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /dev/stdin' \
  < backend/scripts/release-source-manifest.js > "$backup_dir/source-before.json"
# The worker source account stays read-only. Only this backed-up migration uses the app write URI.
deployment_phase='event location migration'
CALM_BACKFILL_SOURCE_URI=$("${compose[@]}" run --rm -T --no-deps --entrypoint printenv backend MONGO_URI)
test -n "$CALM_BACKFILL_SOURCE_URI"
export CALM_BACKFILL_SOURCE_URI
"${compose[@]}" run --rm -T --no-deps -e CALM_BACKFILL_SOURCE_URI --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_BACKFILL_SOURCE_URI" --file /dev/stdin' < backend/scripts/backfill-event-locations.js
unset CALM_BACKFILL_SOURCE_URI
deployment_phase='source integrity verification'
"${compose[@]}" run --rm -T --no-deps --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /dev/stdin' \
  < backend/scripts/release-source-manifest.js > "$backup_dir/source-after.json"
cmp "$backup_dir/source-before.json" "$backup_dir/source-after.json"
deployment_phase='application startup'
"${compose[@]}" up -d --no-deps --wait --wait-timeout 300 backend frontend caddy
# Rebuild the existing dataset from all historical diary entries before starting the loop.
deployment_phase='historical dataset export'
"${compose[@]}" run --rm -T --no-deps --entrypoint /bin/sh training-worker -c \
  'mongosh --quiet "$CALM_TRAINING_SOURCE_URI" --file /scripts/export-shared-risk-training.js'
deployment_phase='training worker startup'
"${compose[@]}" up -d --no-deps --wait --wait-timeout 300 training-worker
deployment_phase='application health check'
"${compose[@]}" exec -T backend wget -qO- http://localhost:8080/api/actuator/health
"${compose[@]}" ps
writers_stopped=false
trap - EXIT
echo "Deployed commit $(git rev-parse HEAD)"
