#!/usr/bin/env bash
# Run the DF Punk local stack without mprocs (no TUI / TTY required).
# Use this when `pnpm dev` (mprocs) exits immediately in Cursor/IDE terminals.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.foundry/bin:${PATH}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

need node
need pnpm
need anvil
need forge

NODE_V="$(node -v | sed 's/^v//')"
PNPM_V="$(pnpm -v)"
if [[ "$NODE_V" != "24.19.0" || "$PNPM_V" != "11.20.0" ]]; then
  echo "Warning: expected Node 24.19.0 + pnpm 11.20.0 (got node=$NODE_V pnpm=$PNPM_V)" >&2
fi

if [[ ! -f packages/client/.env ]]; then
  echo "Missing packages/client/.env — copy from .env.example" >&2
  exit 1
fi
if [[ ! -f packages/contracts/.env ]]; then
  echo "Missing packages/contracts/.env — copy from .env.example" >&2
  exit 1
fi

LOG_DIR="${TMPDIR:-/tmp}/df-punk-dev"
mkdir -p "$LOG_DIR"
PIDS=()

cleanup() {
  echo
  echo "Stopping local stack..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_port() {
  local port="$1"
  local name="$2"
  local tries=60
  for ((i = 1; i <= tries; i++)); do
    if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
      echo "$name is up on :$port"
      return 0
    fi
    sleep 1
  done
  echo "Timed out waiting for $name on :$port" >&2
  echo "See logs in $LOG_DIR" >&2
  exit 1
}

echo "Logs: $LOG_DIR"
echo "Starting anvil..."
(
  cd packages/contracts
  exec anvil --base-fee 0 --block-time 2
) >"$LOG_DIR/anvil.log" 2>&1 &
PIDS+=($!)
wait_port 8545 anvil

echo "Starting mud dev-contracts..."
(
  cd packages/contracts
  exec pnpm mud dev-contracts --rpc http://127.0.0.1:8545
) >"$LOG_DIR/contracts.log" 2>&1 &
PIDS+=($!)

echo "Starting client (waits for :8545)..."
(
  cd packages/client
  exec pnpm run dev
) >"$LOG_DIR/client.log" 2>&1 &
PIDS+=($!)

echo "Starting Lattice explorer..."
(
  cd "$ROOT"
  exec bash scripts/run-explorer.sh
) >"$LOG_DIR/explorer.log" 2>&1 &
PIDS+=($!)

echo
echo "Stack starting:"
echo "  anvil     http://127.0.0.1:8545"
echo "  client    (Vite — see $LOG_DIR/client.log for URL, usually :5173)"
echo "  explorer  http://127.0.0.1:13690"
echo "  contracts mud deployer — $LOG_DIR/contracts.log"
echo
echo "Tail logs:  tail -f $LOG_DIR/*.log"
echo "Stop with Ctrl-C"
echo

# Keep script alive while children run; surface a crash.
while true; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Process $pid exited unexpectedly. Check $LOG_DIR" >&2
      exit 1
    fi
  done
  sleep 2
done
