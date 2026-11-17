#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:?Deployment directory required}"
DEPLOY_SHA="${2:?Commit SHA required}"
case "$DEPLOY_SHA" in
  *[!0-9a-f]*|'') echo "Invalid deployment commit." >&2; exit 1 ;;
esac
if [[ ${#DEPLOY_SHA} -ne 40 ]]; then
  echo "Deployment commit must be a full Git SHA." >&2
  exit 1
fi

cd "$DEPLOY_PATH"
if [[ "$(git rev-parse --show-toplevel)" != "$(pwd -P)" ]]; then
  echo "Deployment path must be the repository root." >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Deployment checkout must be on main." >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked files have local changes; refusing to overwrite them." >&2
  exit 1
fi
if [[ ! -f .env || ! -x backend/.venv/bin/python ]]; then
  echo "Configure .env and create backend/.venv before deploying." >&2
  exit 1
fi
set -a
source .env
set +a
if [[ "${RUN_MODE:-}" != "production" || "${ENVIRONMENT:-}" != "production" ]]; then
  echo "The VPS .env must set RUN_MODE=production and ENVIRONMENT=production." >&2
  exit 1
fi

# Fetch the trusted main ref, then deploy only the commit approved by this workflow.
git fetch --no-tags origin main
git cat-file -e "$DEPLOY_SHA^{commit}"
if ! git merge-base --is-ancestor "$DEPLOY_SHA" FETCH_HEAD; then
  echo "Deployment commit is not on origin/main." >&2
  exit 1
fi
if [[ "$(git rev-parse HEAD)" != "$DEPLOY_SHA" ]] && git merge-base --is-ancestor "$DEPLOY_SHA" HEAD; then
  echo "This commit has been superseded by a newer deployment."
  exit 0
fi
if [[ "$(git rev-parse HEAD)" != "$DEPLOY_SHA" ]]; then
  git merge --ff-only "$DEPLOY_SHA"
fi

backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend ci

# The service sources the VPS .env and builds/migrates before starting both processes.
sudo -n systemctl restart braveactive.service
backend_port="${BACKEND_PORT:-8008}"
frontend_port="${FRONTEND_PORT:-3003}"
for port in "$backend_port" "$frontend_port"; do
  case "$port" in *[!0-9]*|'') echo "Invalid application port." >&2; exit 1 ;; esac
done

for ((attempt=1; attempt<=90; attempt++)); do
  if ! systemctl is-active --quiet braveactive.service; then
    echo "Service failed; inspect journalctl -u braveactive.service." >&2
    exit 1
  fi
  if curl --silent --fail --max-time 2 "http://127.0.0.1:$backend_port/health" >/dev/null \
    && curl --silent --fail --max-time 2 "http://127.0.0.1:$frontend_port/" >/dev/null; then
    echo "Deployment healthy at commit $DEPLOY_SHA."
    exit 0
  fi
  sleep 2
done
echo "Health checks timed out; inspect journalctl -u braveactive.service." >&2
exit 1
