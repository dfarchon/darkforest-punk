#!/usr/bin/env bash
# Scan pnpm-lock.yaml for known-malicious package versions / IOC strings.
# Extend scripts/ci/malware-iocs.txt when new IoCs are published.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

IOC_FILE="$ROOT/scripts/ci/malware-iocs.txt"
LOCK="$ROOT/pnpm-lock.yaml"

if [[ ! -f "$IOC_FILE" ]]; then
  echo "Missing IOC file: $IOC_FILE" >&2
  exit 1
fi
if [[ ! -f "$LOCK" ]]; then
  echo "Missing lockfile: $LOCK" >&2
  exit 1
fi

hits=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  # IOC format: package@version  OR  free-form substring
  if grep -F -- "$line" "$LOCK" >/dev/null 2>&1; then
    echo "IOC MATCH in lockfile: $line" >&2
    hits=$((hits + 1))
  fi
done < "$IOC_FILE"

if [[ "$hits" -gt 0 ]]; then
  echo "Blocked: $hits malware/IOC match(es) in pnpm-lock.yaml" >&2
  exit 1
fi

echo "No known malware IOC matches in pnpm-lock.yaml."
