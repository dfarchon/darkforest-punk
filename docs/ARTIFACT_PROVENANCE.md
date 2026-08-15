# Generated / vendored artifact provenance

# TODO# MUST BE DONE STX — For each artifact below, fill source repo/version,
# generation command, SHA-256, and wire CI rebuild-vs-committed digest checks.

| Artifact | Source | Generation command | SHA-256 | Notes |
|----------|--------|--------------------|---------|-------|
| `packages/client/public/snarkjs.min.js` | TBD | TBD | TBD | Vendored |
| `packages/client/public/**/*.zkey` | TBD | TBD | TBD | SNARK keys |
| `packages/client/public/**/*.wasm` | TBD | TBD | TBD | Circuits |
| `packages/client/public/**/*.r1cs` (if tracked) | TBD | TBD | TBD | |
| `CCapture.all.min.js` (if present) | TBD | TBD | TBD | |
| Generated contract codegen | MUD / `mud build` | TBD | TBD | Prefer regenerate in CI |

Rules:

1. Unexplained binary/minified diffs require security-owner review (`CODEOWNERS`).
2. Prefer isolated CI rebuild + digest compare over trusting committer laptops.
3. Do not reintroduce `*.backup` / `*.bak` files into the tree.
