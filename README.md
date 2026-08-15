# Dark Forest MUD (🦑,🪐)

"These violent delights have violent ends."

For the latest updates on the project, Please follow our [twitter](https://x.com/darkforest_mud) or join our [discord](https://discord.gg/XpBPEnsvgX).

If you wish to contribute to the project or support our development financially, we invite you to reach out to us.

Dark Forest MUD is community-driven development of [Dark Forest game](https://x.com/darkforest_eth) on [MUD engine](https://mud.dev/), powerd by [DFArchon team](https://x.com/DFArchon).

Prior to the full launch of the project, periodic testing events will be held. We welcome all participants to engage with us.

# Website

v0.1.1 round: https://r1.dfmud.xyz/

v0.1.2 round: https://r2.dfmud.xyz/

# Local Development Setup

Required tooling (exact): **Node.js `24.19.0`** (Active LTS) and **pnpm `11.20.0`** (Corepack / `packageManager` field). See [CONTRIBUTING.md](./CONTRIBUTING.md).

1. Copy `packages/client/.env.example` → `packages/client/.env`.
2. Copy `packages/contracts/.env.example` → `packages/contracts/.env`.
3. Enable Corepack and install from the lockfile only:

```bash
corepack enable
pnpm install --frozen-lockfile
```

If pnpm reports `ERR_PNPM_IGNORED_BUILDS`, do **not** run `pnpm approve-builds --all`. Review `allowBuilds` in `pnpm-workspace.yaml`, then re-run the frozen install so approved packages can build.

4. Install pinned Foundry separately (not during JS install):

```bash
pnpm setup:foundry
export PATH="$HOME/.foundry/bin:$PATH"
```

5. Run the stack:

```bash
# Preferred in a real external terminal (Windows Terminal / gnome-terminal):
pnpm dev

# If `pnpm dev` exits immediately (Cursor/IDE terminal has no TTY for mprocs):
pnpm dev:local
# logs under /tmp/df-punk-dev/ ; Ctrl-C to stop
```

`pnpm dev` uses **mprocs** (full-screen TUI). It needs a real interactive TTY. In many IDE terminals it fails with `No such device or address` and returns to the prompt with no processes running — that is an environment limitation, not a broken install.

Never use unlocked `npx` bootstrap scripts or `curl | bash` installers via package lifecycle hooks.

# Security

- [SECURITY.md](./SECURITY.md) — reporting and hardening summary
- [docs/INCIDENT_RESPONSE.md](./docs/INCIDENT_RESPONSE.md) — supply-chain incident procedure
- [docs/DEPENDENCY_UPGRADE_BACKLOG.md](./docs/DEPENDENCY_UPGRADE_BACKLOG.md) — prioritized vulnerability upgrades (separate branch; inspect lockfile diffs)

# To-Do List

1. Continue to introduce new artifacts and complete the guild features, thereby enriching the game’s content and attracting a larger player base.
2. Optimize the user onboarding process and refine the delegation mechanism for user game accounts.
3. Develop a management queue for handling a high volume of onchain transactions.
