#!/usr/bin/env bash
set -euo pipefail

for name in DEPLOY_HOST DEPLOY_USER DEPLOY_PATH DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS DEPLOY_SHA; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing GitHub secret or value: $name" >&2
    exit 1
  fi
done

# These values become part of the remote shell command. Restrict their syntax.
[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9.:-]+$ ]] || exit 1
[[ "$DEPLOY_USER" =~ ^[a-z_][a-zA-Z0-9_-]*$ ]] || exit 1
[[ "$DEPLOY_PATH" =~ ^/[a-zA-Z0-9_./-]+$ ]] || exit 1
[[ "$DEPLOY_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 1

ssh_dir=$(mktemp -d)
trap 'rm -rf "$ssh_dir"' EXIT
chmod 700 "$ssh_dir"
printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/id_ed25519"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/id_ed25519" "$ssh_dir/known_hosts"

ssh -i "$ssh_dir/id_ed25519" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$ssh_dir/known_hosts" -o ConnectTimeout=15 \
  "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && bash -s -- '$DEPLOY_SHA'" \
  < .github/scripts/deploy-on-server.sh
