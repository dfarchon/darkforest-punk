# `security/deps-critical` playbook — safe upgrades + safe deploys

Goal: clear CRITICAL/HIGH advisory debt **without** blind `audit --fix`, and ship production builds that do not install or trust unnecessary attack surface.

## Rules (non-negotiable)

1. One PR group at a time. Never one mega lockfile rewrite.
2. After each group: `pnpm install` → inspect `pnpm-lock.yaml` → `pnpm install --frozen-lockfile` → build + test.
3. No `pnpm approve-builds --all`. Update `allowBuilds` only for reviewed natives.
4. Production deploy builds run in clean CI from a protected branch — not from a laptop that holds wallets.
5. Never deploy using `packages/contracts/.env` Anvil `PRIVATE_KEY`.
6. Prefer **remove** unused tools over upgrading them.

## Branch bootstrap

```bash
git checkout -b security/deps-critical
# work only on this branch until merged behind reviews
```

Keep using Node `24.19.0` + pnpm `11.20.0` (Corepack).

---

## Deploy safety model (read first)

| Layer | What ships to users | What must be safe |
|-------|---------------------|-------------------|
| Browser bundle (`vite build`) | Client JS (ethers, viem, wagmi, langchain if imported, MUD) | Crypto libs, no malware in resolved versions |
| Deploy machine (`netlify-cli`) | Build/upload tooling only | CLI + transitive `tar`/`next` graph; prefer CI-only install |
| Contracts deploy (`mud deploy`) | Onchain bytecode | Foundry pin, deployer key via hardware/OIDC/secret store — never Anvil key |
| Local `pnpm dev` | Dev servers | Vite/Vitest vulns matter if bound beyond localhost |

**Deploy checklist (every production release):**

- [ ] Commit is on protected branch; CI green (Security Gates + Client + Contracts)
- [ ] `pnpm install --frozen-lockfile` in CI (no lockfile mutation)
- [ ] Production `PRIVATE_KEY` / deployer secrets only in CI environment (OIDC / short-lived), never in git
- [ ] Client build: `pnpm --filter client run build` (not `vitest --ui`)
- [ ] Netlify token is scoped deploy-only; no npm publish token on that job
- [ ] Contracts: explicit network profile (`deploy:base`, etc.); verify world address before announcing
- [ ] Post-deploy: record commit SHA, lockfile hash, artifact hashes (SBOM when workflow runs)

---

## PR groups (do in order)

### PR-1 — Crypto floor (CRITICAL, production wallet path)

**Why:** `ethers@5.7.x` pulls `pbkdf2@3.1.2` and `sha.js@2.4.11` (CRITICAL). Used heavily in the client for wallets/signing.

**Preferred path (smaller blast radius first):** pin patched transitive versions via `pnpm-workspace.yaml` overrides while staying on ethers v5:

```yaml
overrides:
  better-sqlite3: 12.11.1
  pbkdf2: 3.1.6          # CRITICAL fixes from >=3.1.3 (use latest 3.1.x)
  sha.js: 2.4.12         # CRITICAL fix
  elliptic: 6.6.1        # force single version; avoid leftover 6.5.4
```

Verify patched versions against [OSV](https://osv.dev) / GitHub Advisory **before** writing them (do not guess).

**Then:**

```bash
pnpm install
git diff pnpm-lock.yaml   # expect mainly pbkdf2/sha.js/elliptic
pnpm install --frozen-lockfile
pnpm --filter client run build
pnpm --filter client run test
pnpm --filter contracts test   # if time permits
```

**Follow-up (larger, later PR):** migrate client off `ethers` v5 toward `viem` (already in tree) for signing/utils. That removes the worst transitive crypto tree long-term.

**Merge gate:** no new lifecycle scripts; integrity matches registry; client build green.

---

### PR-2 — Vite / Vitest (HIGH / CRITICAL-dev)

**Why:** Vite `6.2.5` path-bypass advisories; Vitest `3.1.1` UI RCE if UI server exposed.

```bash
# in packages/client/package.json — confirmed OSV-clean on 2026-08-15:
# "vite": "6.4.3"
# "vitest": "3.2.7"
# Avoid jumping to Vite 8 / Vitest 4 in the same PR.
```

```bash
pnpm install
pnpm --filter client run build
pnpm --filter client run test   # keep "vitest run" only — never require --ui in CI
```

**Deploy rule:** CI and humans must not run `vitest --ui` on shared/networked hosts.

---

### PR-3 — LangChain (HIGH, in client dependencies)

**Why:** `langchain@0.3.6` serialization injection (secret extraction). It is a **runtime dependency** of the client.

Options (pick one, prefer A if AI chat is non-critical for launch):

- **A (safest):** remove `langchain` / `@langchain/*` from production client; load AI behind a separate backend only.
- **B:** upgrade to patched LangChain releases; retest `AIChatPane` / any serializers.

Do not leave a vulnerable LangChain in the production bundle “because it’s unused” without verifying Vite does not include it (check bundle analyzer / import graph).

---

### PR-4 — Shrink Netlify / Next / tar attack surface (HIGH, deploy path)

**Why:** `netlify-cli@17.37.1` pulls a huge tree (`next@14.2.5`, `tar@6.2.1`, old `ws`, Sentry native, etc.). That is **deploy-machine** risk.

**Safest pattern:**

1. Remove `netlify-cli` from `packages/client` `devDependencies`.
2. Change `deploy:prod` to a thin wrapper that expects Netlify CLI from CI image or `pnpm dlx` **pinned by exact version + hash in CI only** (reviewed).
3. Or: move Netlify deploy to a dedicated workflow that installs CLI in an isolated job after build artifacts are already produced (build job has no Netlify token; deploy job has no writable package install from untrusted PRs).

Until then: keep `allowBuilds.netlify-cli: false` (already set).

---

### PR-5 — Lattice / Explorer / Next (as needed)

Upgrade or isolate `@latticexyz/explorer` so production client installs do not need Next. Explorer is local-dev only — keep it out of production Docker/Netlify install profiles if you split them.

---

## Per-PR review checklist (paste into PR body)

```markdown
## Summary
- Group: (crypto | vite | langchain | netlify | mud)
- Advisories addressed: (GHSA-…)

## Lockfile
- [ ] Diff limited to intended packages
- [ ] No unexpected git/URL deps
- [ ] No new allowBuilds=true without note
- [ ] Integrity hashes spot-checked against registry for touched packages

## Verify
- [ ] pnpm install --frozen-lockfile
- [ ] pnpm --filter client run build
- [ ] pnpm --filter client run test
- [ ] contracts tests / mud build if contracts touched

## Deploy impact
- [ ] Production bundle / deploy CI considered
- [ ] No long-lived tokens added
- [ ] No Anvil keys used for real networks
```

---

## What “safe enough to deploy” means

You may deploy a **client static build** when:

1. PR-1 (crypto overrides or ethers migration) is merged
2. PR-2 (Vite) is merged
3. LangChain is either removed from the client or upgraded (PR-3)
4. Deploy job does not need a compromised Netlify CLI install on an interactive laptop (PR-4 path at least scoped)
5. CI frozen install + build + Security Gates are green on the release commit

Contract deploys additionally require: pinned Foundry, non-Anvil key, correct network profile, and post-deploy address verification.

---

## Commands cheat sheet

```bash
# after editing package.json / overrides
pnpm install
git diff --stat pnpm-lock.yaml
pnpm install --frozen-lockfile

# verify
pnpm --filter client run build
pnpm --filter client run test
pnpm run build

# never for this work
# pnpm audit --fix
# pnpm approve-builds --all
# pnpm update -r
```
