### Starbase Design

This document describes the current design and behavior of Starbases across contracts and client code. It reflects the atomic create+reveal flow, current validation, client submission and guards, data tables, and rendering.

### Goals

- Player-crafted starbases created from owned PLANETs (level ≥ 4).
- Single atomic transaction to create and reveal, avoiding partial success.
- Immediately visible to all clients via standard `RevealedPlanet` sync.
- Extensible for starbase subtypes (Default now; Research/Trade later).

### On-chain: StarbaseSystem

- Entry point: `StarbaseSystem.createStarBase(...)` performs create and reveal atomically.
- Enforces reveal cooldown specific to starbases via `TempConfigSet.getRevealSBCd()`; reverts with `RevealStarBaseTooOften()`.
- Validates source planet:
  - Must be `PlanetType.PLANET`
  - Must have `level ≥ 4`
  - Must be owned by `msg.sender`
  - Must satisfy material requirements (WINDSTEEL 500, SCRAPIUM 400, PYROSTEEL 300; scaled by CONTRACT_PRECISION).
- Prevents multiple starbases from the same source via `StarbasePlanet`.
- Writes constants and owner, consumes materials, sets initial `Planet` with population via `PlanetInitialResource`.
- Reveals coordinates and syncs the new starbase using `RevealedPlanet.set(...)` and `DFUtils.readAnyPlanet(...).writeToStore()`.
- Validates distance from the source planet by comparing the universe-adjusted travel distance against 50% of the source planet’s range (`StarbaseTooFarFromSource()`).

Contract function (parameters and order):

```solidity
function createStarBase(
  uint256 sourcePlanetHash,
  uint256 starbaseHash,
  address owner,
  uint8 perlin,
  uint8 level,
  SpaceType spaceType,
  uint8 starbaseType, // 0 = Default
  int256 x,
  int256 y,
  uint256 distance // provided by client UI, mirrors MoveSystem input
) public entryFee
```

Key errors and guards:

- `RevealStarBaseTooOften()` – starbase reveal cooldown not satisfied.
- `InvalidPlanetType()` – source is not `PLANET`.
- `PlanetLevelTooLow()` – source level < 4.
- `NotPlanetOwner()` – caller does not own source.
- `NotEnoughMaterial()` – source lacks required materials.
- `PlanetAlreadyHasStarbase()` – source already produced a starbase.
- `InvalidPlanetHash()` – destination hash already exists (uniqueness).
- `StarbaseTooFarFromSource()` – attempted placement exceeds 50% of source planet range.

Tables used:

- `PlanetConstants`, `Planet`, `PlanetOwner` – standard planet records for the starbase.
- `RevealedPlanet` – stores `x, y, revealer` for revealed coordinates.
- `StarbaseType` – stores subtype (0=Default for now).
- `StarbasePlanet` – maps source planet to the created starbase hash.

### Client: Submission and Guards

- The client submits a single tx `df__createStarBase` with:
  - `sourcePlanetHash, starbaseHash, owner, perlin, level, spaceType, starbaseType(=0), x, y, distance`.
- `starbaseHash` is deterministically generated from coordinates:
  - `keccak256(abi.encodePacked("STARBASE", x, y))`.
- Guard before submit:
  - Blocks if target coordinates are not inside a discovered chunk (`hasMinedChunk`) to avoid create attempts in undiscovered maps that would otherwise fail reveal.
  - Validates the placement distance client-side using `getDistCoords(...)` and rejects attempts beyond 50% of the source planet’s range (matching the contract guard). The computed integer distance (ceil) is sent to the contract call.
- When the `StarbaseCraftingPane` is in “choose location” mode, the `GameUIManager` tracks the source planet, a dashed red circle is rendered via `PlanetRenderManager` to visualize the allowable 50% radius, and the pane displays red error text if the hovered coordinates exceed the limit.
- After confirmation, the client calls a targeted refresh for the created starbase to reflect immediately on the owner’s viewport.

### Client: Sync and Visibility

- Revealed planets (including starbases) arrive over MUD sync via `RevealedPlanet`.
- The client reindexes the planet inside the layered map after a `hardRefreshPlanet`, ensuring the object is placed in the correct quadtree level and is visible for everyone without manual refresh.
- An explicit "reindex" path avoids flicker or transient disappearance on the owner’s client.

### Materials

- Default costs (on-chain, scaled by CONTRACT_PRECISION = 1000):
  - WINDSTEEL: 500
  - SCRAPIUM: 400
  - PYROSTEEL: 300

### Rendering

- Starbases use a dedicated shader and renderer:
  - `StarbaseProgram.ts` draws the layered base structure; the vertex shader applies a slight front-facing tilt and the fragment shader renders the rings without legacy debug geometry.
  - `StarbaseRenderer.ts` queues the concentric layers, applies 180° rotation to module slots, and uses `ModuleIconRenderer` to draw weapon/hull/shield icons sourced from PNG textures.
- Module icons are texture-backed sprites (Engines disabled for now) with type-specific textures (`@1Cannon.png`, `@Engines.png`, `@Hull.png`, `@Shield.png`) and distinct slot angles based on current counts.
- The old shader-drawn blue circles and red triangles were removed; only the textured modules remain atop the base.
- Subtype-specific styles are reserved for future expansion; Default subtype uses the current tilt + texture styling.

### Hashing and Placement

- Starbases are not procedurally generated; placement is explicit via coordinates.
- Contract ensures uniqueness by checking `PlanetConstants` for the provided `starbaseHash`.
- Coordinates are recorded in `RevealedPlanet` during the atomic call.

### Cooldown and Stats

- Cooldown: `LastReveal.get(owner) + TempConfigSet.getRevealSBCd() <= Ticker.getTickNumber()`.
- Stats updated on atomic reveal:
  - `GlobalStats.setRevealLocationCount(...)`
  - `PlayerStats.setRevealLocationCount(owner, ...)`

### Ownership and Permissions

- Player-driven: creator must own the source planet.
- Ownership of the starbase is set to the provided `owner` address at creation.
- Future work may add starbase-specific permissions and abilities.

### Future Extensions

- Subtypes: Research and Trade (type-specific gameplay bonuses and visuals).
- Additional validation (e.g., strictly vacant coordinate index).
- Crafting UI for type selection and material previews.
- Extended client-side effects and instancing for performance if starbase count grows.

### Starbase Modules (Current Branch)

This branch adds a modular system for Starbases paralleling the Spaceship module system.

Contract: `StarbaseModuleSystem`

- Public entrypoints:
  - `installStarbaseModule(uint256 starbaseHash, uint32 moduleId)` – installs a module onto a starbase the caller owns.
  - `uninstallStarbaseModule(uint256 starbaseHash, uint32 moduleId)` – uninstalls a previously installed module back to the starbase’s artifact storage.
- Slot model:
  - Slot types (note: slotType ids are not sequential 1..4):
    - ENGINES_SLOT = 0
    - WEAPONS_SLOT = 1
    - HULL_SLOT = 3
    - SHIELD_SLOT = 4
  - Slot indices (logical “display” positions):
    - Engines → index 1
    - Weapons → index 2
    - Hull/Shield → index 3 (shared)
  - Slot limits (from contract constants):
    - Engines: 0 (disabled)
    - Weapons: 4
    - Hull: 4
    - Shield: 4
- Validation highlights (mirrors spaceship logic):
  - Planet ownership and type check (`PlanetType.STARBASE`).
  - Module must be on this starbase planet (ArtifactOwner).
  - Module must be a module artifact (artifactIndex = 23) and exist in `CraftedModules`.
  - Determine `slotType` from `moduleType`, compute `slotIndex`.
  - If the logical slot already holds a module:
    - If same moduleId → allow replacement (no limit check).
    - If different module and same slotType → check currentCount vs limit:
      - `currentCount` is computed from the single `StarbaseSlot` entry (0 or 1).
      - If `currentCount >= limit` → revert `ModuleSlotFull()`.
    - If different slotType shares the same index (Hull vs Shield) → allowed.
- Storage tables used:
  - `StarbaseSlot(starbaseHash, moduleSlotindex)` → `{ moduleSlotType, moduleId }` (single “display” entry per logical index).
  - `StarBaseModuleInstalled(moduleId)` → `{ starbaseHash, moduleSlotType, installed }` (keyed by moduleId).
  - `CraftedModules(moduleId)` / `ModuleBonus(moduleId)` – module metadata and bonuses.
- Bonuses (multiplicative):
  - On install:
    - `defense = defense * defenseBonus / 100`
    - `speed = speed * (speedBonus + attackBonus/2) / 100`
    - `range = range * (rangeBonus + attackBonus/2) / 100`
  - On uninstall (exact inverse):
    - `defense = defense * 100 / defenseBonus (guard 100 if 0)`
    - `speed = speed * 100 / (speedBonus + attackBonus/2) (guard 100 if 0)`
    - `range = range * 100 / (rangeBonus + attackBonus/2) (guard 100 if 0)`
  - Notes:
    - Use widening math (uint256) during multiplicative/division steps.
    - Inverse factors are guarded: if a factor is 0 treat as 100 (no-op).
- Known limitations (MVP):
  - `StarbaseSlot` stores a single “display” module per logical index; it does not list all installed modules per slot. Limits > 1 rely on a 0/1 count from this display slot, so UI should be the primary place to surface multi-per-slot presence. A proper per-slot indexed table would be required to render multiple “displayed” modules simultaneously.

Client

- New system calls are routed via:
  - ABI/SystemId mapping for `df__installStarbaseModule` and `df__uninstallStarbaseModule` (StarbaseModuleSystem).
- Starbase Module Management UI (`StarbaseModuleManagementPane.tsx`):
  - Reads `StarBaseModuleInstalled` and `CraftedModules` to assemble installed modules per starbase and resolve `moduleType` for grouping.
  - Groups by module type (Engines/Weapons/Hull/Shield); uses contract mirroring slot limits:
    - Engines: 0 (disabled)
    - Weapons: 4
    - Hull: 4
    - Shield: 4
  - After install/uninstall, triggers `hardRefreshPlanet` and a local refresh key to re-query tables and update the pane.
  - “Install” disables if slot limit is 0 or the number of installed modules of that type reaches the limit; “Uninstall” available for installed rows.
  - Because `StarbaseSlot` is a single display entry per index, the UI list is sourced from `StarBaseModuleInstalled` (keyed by `moduleId`) to reflect all installed modules.

Future work (slot model)

- To fully support multi-per-slot renders:
  - add useInstalledStarbaseModules useInstalledModules function to render module sprites directly from `StarBaseModuleInstalled` now that the legacy blue/red debug geometry has been removed
