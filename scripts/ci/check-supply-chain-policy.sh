#!/usr/bin/env bash
# Policy checks for DF Punk supply-chain hardening. Fail closed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail=0

note() { printf '%s\n' "$*"; }
err() { printf 'ERROR: %s\n' "$*" >&2; fail=1; }

# 1) Actions must be pinned to 40-char SHAs (ignore vendored OZ workflows).
while IFS= read -r file; do
  while IFS= read -r line; do
    if [[ "$line" =~ uses:[[:space:]]*([^@[:space:]]+)@([^[:space:]]+) ]]; then
      action="${BASH_REMATCH[1]}"
      ref="${BASH_REMATCH[2]}"
      # Strip trailing comments already excluded by regex character class roughly; trim #...
      ref="${ref%%#*}"
      if [[ ! "$ref" =~ ^[0-9a-f]{40}$ ]]; then
        err "$file: action $action@$ref is not a full commit SHA"
      fi
    fi
  done < "$file"
done < <(find .github/workflows .github/actions -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null)

# 2) package.json must not use unlocked npx / curl|bash installers.
if grep -E '"preinstall"[[:space:]]*:[[:space:]]*"npx ' package.json >/dev/null 2>&1; then
  err "package.json preinstall uses npx (unlocked download)"
fi
if grep -E 'curl .+\|[[:space:]]*bash' package.json >/dev/null 2>&1; then
  err "package.json contains curl|bash installer"
fi
if grep -E '"foundry:up"' package.json >/dev/null 2>&1; then
  err "package.json still defines foundry:up curl installer"
fi

# 3) Require exact engines + packageManager pin.
node_engine="$(python3 - <<'PY'
import json
print(json.load(open("package.json"))["engines"]["node"])
PY
)"
pnpm_engine="$(python3 - <<'PY'
import json
print(json.load(open("package.json"))["engines"]["pnpm"])
PY
)"
pm="$(python3 - <<'PY'
import json
print(json.load(open("package.json"))["packageManager"])
PY
)"

if [[ "$node_engine" != "24.19.0" ]]; then
  err "engines.node must be exact 24.19.0 (got $node_engine)"
fi
if [[ "$pnpm_engine" != "11.20.0" ]]; then
  err "engines.pnpm must be exact 11.20.0 (got $pnpm_engine)"
fi
if [[ "$pm" != pnpm@11.20.0* ]]; then
  err "packageManager must pin pnpm@11.20.0 (got $pm)"
fi

# 4) CI install commands must be frozen.
if grep -RInE 'pnpm[[:space:]]+install([^-]|$)' .github/workflows | grep -v 'frozen-lockfile' >/dev/null 2>&1; then
  err "Found pnpm install without --frozen-lockfile in workflows"
fi

# 5) .npmrc must not contain tokens.
if [[ -f .npmrc ]] && grep -Ei '(_auth|authToken|\/\/.*:_password)' .npmrc >/dev/null 2>&1; then
  err ".npmrc appears to contain credentials"
fi

# 6) Default workflow permissions should be contents:read at top level.
for wf in .github/workflows/*.yml .github/workflows/*.yaml; do
  [[ -f "$wf" ]] || continue
  if ! grep -qE '^permissions:' "$wf"; then
    err "$wf missing top-level permissions block"
  fi
done

# 7) Disallow pull_request_target checking out untrusted code patterns (heuristic).
if grep -RIn 'pull_request_target' .github/workflows >/dev/null 2>&1; then
  err "pull_request_target is banned; use pull_request with least privilege"
fi

if [[ "$fail" -ne 0 ]]; then
  note "Supply-chain policy checks failed."
  exit 1
fi

note "Supply-chain policy checks passed."
