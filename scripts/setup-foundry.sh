#!/usr/bin/env bash
# Install a pinned Foundry release from GitHub Releases (no curl|bash installer).
# Usage: pnpm setup:foundry
# Override: FOUNDRY_VERSION=v1.1.0 pnpm setup:foundry
set -euo pipefail

FOUNDRY_VERSION="${FOUNDRY_VERSION:-v1.1.0}"
INSTALL_DIR="${FOUNDRY_DIR:-$HOME/.foundry/bin}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKSUMS_FILE="${REPO_ROOT}/scripts/foundry-checksums.sha256"

if command -v forge >/dev/null 2>&1; then
  current="$(forge --version 2>/dev/null | head -n1 || true)"
  if [[ "$current" == *"${FOUNDRY_VERSION#v}"* ]] || [[ "$current" == *"$FOUNDRY_VERSION"* ]]; then
    echo "Foundry already installed: $current"
    exit 0
  fi
  echo "Found forge on PATH ($current) but it does not match FOUNDRY_VERSION=$FOUNDRY_VERSION."
  echo "Continuing with pinned install into $INSTALL_DIR."
fi

uname_s="$(uname -s)"
uname_m="$(uname -m)"
case "$uname_s-$uname_m" in
  Linux-x86_64) platform="linux_amd64" ;;
  Linux-aarch64|Linux-arm64) platform="linux_arm64" ;;
  Darwin-x86_64) platform="darwin_amd64" ;;
  Darwin-arm64) platform="darwin_arm64" ;;
  *)
    echo "Unsupported platform: $uname_s $uname_m"
    exit 1
    ;;
esac

asset="foundry_${FOUNDRY_VERSION}_${platform}.tar.gz"
url="https://github.com/foundry-rs/foundry/releases/download/${FOUNDRY_VERSION}/${asset}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "Downloading $url"
curl -fsSL -o "$tmpdir/$asset" "$url"

if [[ ! -f "$CHECKSUMS_FILE" ]]; then
  echo "Missing checksums file: $CHECKSUMS_FILE"
  exit 1
fi

expected="$(awk -v f="$asset" '$2 == f { print $1; found=1 } END { if (!found) exit 1 }' "$CHECKSUMS_FILE")" || {
  echo "No committed checksum for $asset in $CHECKSUMS_FILE"
  echo "Record the SHA-256 before installing: sha256sum $asset >> scripts/foundry-checksums.sha256"
  exit 1
}

actual="$(sha256sum "$tmpdir/$asset" | awk '{print $1}')"
if [[ "$actual" != "$expected" ]]; then
  echo "Checksum mismatch for $asset"
  echo "  expected: $expected"
  echo "  actual:   $actual"
  exit 1
fi
echo "Checksum verified for $asset"

mkdir -p "$INSTALL_DIR"
tar -xzf "$tmpdir/$asset" -C "$INSTALL_DIR"
chmod +x "$INSTALL_DIR"/forge "$INSTALL_DIR"/cast "$INSTALL_DIR"/anvil "$INSTALL_DIR"/chisel 2>/dev/null || true

echo "Installed Foundry $FOUNDRY_VERSION to $INSTALL_DIR"
echo "Add to PATH: export PATH=\"$INSTALL_DIR:\$PATH\""
"$INSTALL_DIR/forge" --version || true
