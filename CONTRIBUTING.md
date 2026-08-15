# Contributing to DF Punk

## Tooling (required)

| Tool | Exact version |
|------|----------------|
| Node.js | `24.19.0` (Active LTS) |
| pnpm | `11.20.0` (via Corepack / `packageManager`) |

Enable Corepack so the repo `packageManager` field is honored:

```bash
corepack enable
corepack prepare pnpm@11.20.0 --activate
node --version   # v24.19.0
pnpm --version   # 11.20.0
```

Do **not** use `npm` or `yarn`. Do **not** run `npx` to bootstrap tools in this repo.

## Install dependencies

Always install from the committed lockfile:

```bash
pnpm install --frozen-lockfile
```

If this fails, your local manifests disagree with `pnpm-lock.yaml`. Fix the manifests deliberately, regenerate the lockfile in a reviewed change, and inspect the lockfile diff before opening a PR.

Never rely on CI to regenerate or “fix” the lockfile.

## Foundry

JavaScript `pnpm install` must not install Foundry.

```bash
pnpm setup:foundry
# or: FOUNDRY_VERSION=v1.1.0 bash scripts/setup-foundry.sh
export PATH="$HOME/.foundry/bin:$PATH"
forge --version
```

`scripts/setup-foundry.sh` downloads a pinned GitHub Release archive and verifies SHA-256 against `scripts/foundry-checksums.sha256`.

<!-- TODO# MUST BE DONE STX: fill real SHA-256 digests in scripts/foundry-checksums.sha256 before first local Foundry install. -->

## Local development

1. Copy `packages/client/.env.example` → `packages/client/.env`
2. Copy `packages/contracts/.env.example` → `packages/contracts/.env` (path names in README may say `eth`; use `contracts`)
3. `pnpm install --frozen-lockfile`
4. `pnpm setup:foundry` (once)
5. `pnpm dev` (external terminal with a real TTY), or `pnpm dev:local` inside Cursor/IDE if mprocs exits immediately.

## Supply-chain rules for contributors

- Pin direct dependencies to exact versions (no `latest`, no floating ranges when avoidable).
- Keep workspace deps as `workspace:*`.
- Git dependencies must pin a full commit SHA and be security-reviewed.
- Do not add packages that require install lifecycle scripts unless they are set to `true` under `allowBuilds` in `pnpm-workspace.yaml` after review. Keep deploy-only tools (`netlify-cli`, `sharp`, …) at `false`.
- Treat `package.json`, `pnpm-lock.yaml`, `.npmrc`, and `.github/workflows/**` changes as security-sensitive.

## Pull requests

PRs that touch dependencies or workflows should expect mandatory checks: frozen install, dependency review, IOC/malware scan, secret scan, and policy checks. See [SECURITY.md](./SECURITY.md).
