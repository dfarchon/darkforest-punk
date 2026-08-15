#!/usr/bin/env bash
# Launch Lattice explorer with Node-24 workarounds applied.
# mprocs must call this script (not bare `pnpm exec explorer`) so NODE_OPTIONS
# is set before the explorer parent and its sqlite-indexer child start.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHIM="${ROOT}/scripts/sentry-profiler-shim.cjs"
if [[ ! -f "$SHIM" ]]; then
  echo "Missing Sentry profiler shim: $SHIM" >&2
  exit 1
fi

# Idempotent local patches for Node 24 + better-sqlite3 sync transactions.
node "${ROOT}/scripts/patch-explorer-node24.cjs"

export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--require ${SHIM}"
exec pnpm exec explorer "$@"
