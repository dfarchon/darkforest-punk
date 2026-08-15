# Security

## Reporting a vulnerability

If you believe you have found a security issue in DF Punk (contracts, client, or supply chain), contact the DFArchon maintainers privately via Discord or Twitter linked in the README. Do not open a public issue for unreleased vulnerabilities or active supply-chain compromises.

## Hardening overview

This repository aims for reproducible installs and least-privilege CI:

- Exact Node `24.19.0` and pnpm `11.20.0` (`engines` + `packageManager`)
- `pnpm install --frozen-lockfile` only in CI
- No unlocked `npx` bootstrap; no `curl | bash` in package lifecycle scripts
- GitHub Actions pinned to full commit SHAs
- Default workflow permission: `contents: read`
- Fork PRs do not receive production secrets or writable shared caches
- Lifecycle scripts deny-by-default via `allowBuilds` in `pnpm-workspace.yaml`
- IOC / known-malware scan of `pnpm-lock.yaml` on every PR and daily schedule

## Dependency upgrades

Do **not** run a blind `pnpm audit --fix` / forced upgrade.

1. Open a dedicated branch.
2. Upgrade direct dependencies in small groups (crypto → LangChain → Vite/Vitest → Lattice → wallets → CI-only tools).
3. Regenerate the lockfile, inspect added/removed packages, new scripts, and integrity changes.
4. Build, test, then merge after security-owner review.

Remove unused packages instead of upgrading them. CI-only tools should not sit in the production client runtime graph when avoidable.

## Generated artifacts

Tracked SNARK / vendor artifacts (`.zkey`, `.wasm`, `snarkjs.min.js`, etc.) must have documented provenance: source, generation command, SHA-256, and review for unexplained diffs. Prefer rebuilding in isolated CI and comparing digests.

See [docs/ARTIFACT_PROVENANCE.md](./docs/ARTIFACT_PROVENANCE.md).

<!-- TODO# MUST BE DONE STX — Complete artifact provenance table and add CI digest verification. -->

## Publishing

<!-- TODO# MUST BE DONE STX — Enable npm trusted publishing (OIDC) when packages are published; remove any long-lived NPM_TOKEN from CI secrets; require protected-branch + environment approval. -->

If npm packages are published from this org, use npm trusted publishing with GitHub Actions OIDC — no long-lived `NPM_TOKEN` on PR workflows. Publishing must run only from protected branches after approval.

## Org / GitHub settings (manual)

<!-- TODO# MUST BE DONE STX — In GitHub org/repo settings enable: Dependabot alerts + security updates, dependency review enforcement, secret scanning + push protection, code scanning, branch protection on `main` (required checks from Security Gates / Client / Contracts), and phishing-resistant 2FA / passkeys for maintainers. -->

## Incident response

See [docs/INCIDENT_RESPONSE.md](./docs/INCIDENT_RESPONSE.md).
