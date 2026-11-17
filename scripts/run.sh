#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env. Copy .env.example to .env and configure PostgreSQL and SMTP." >&2
  exit 1
fi

# This file is trusted shell configuration; quote values containing special characters.
set -a
source "$ROOT/.env"
set +a

MODE="${RUN_MODE:-development}"
FRONTEND_PORT="${FRONTEND_PORT:-3003}"
BACKEND_PORT="${BACKEND_PORT:-8008}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:$BACKEND_PORT}"
export NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://localhost:$BACKEND_PORT/ws/feed}"

if [[ ! -x "$ROOT/backend/.venv/bin/python" || ! -f "$ROOT/frontend/node_modules/next/dist/bin/next" ]]; then
  echo "Dependencies missing. Follow the setup instructions in README.md." >&2
  exit 1
fi
if [[ "$MODE" != "development" && "$MODE" != "production" ]]; then
  echo "RUN_MODE must be development or production." >&2
  exit 1
fi

(cd "$ROOT/backend" && .venv/bin/alembic upgrade head)
if [[ "$MODE" == "production" ]]; then
  (cd "$ROOT/frontend" && npm run build)
fi

backend_pid=""
frontend_pid=""
cleanup() {
  trap - EXIT INT TERM
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(cd "$ROOT/backend" && exec .venv/bin/uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT") &
backend_pid=$!
if [[ "$MODE" == "production" ]]; then
  (cd "$ROOT/frontend" && exec node node_modules/next/dist/bin/next start --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT") &
else
  (cd "$ROOT/frontend" && exec node node_modules/next/dist/bin/next dev --hostname "$FRONTEND_HOST" --port "$FRONTEND_PORT") &
fi
frontend_pid=$!

echo "Backend PID $backend_pid; frontend PID $frontend_pid. Press Ctrl+C to stop both."
# Portable to macOS's Bash 3: stop the other process if either service exits.
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done
echo "A service exited; stopping the other service." >&2
exit 1
