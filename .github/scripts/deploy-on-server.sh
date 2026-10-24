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
"${compose[@]}" up -d --build --no-deps --wait backend frontend training-worker caddy
"${compose[@]}" exec -T backend wget -qO- http://localhost:8080/api/actuator/health
"${compose[@]}" ps
echo "Deployed commit $(git rev-parse HEAD)"
