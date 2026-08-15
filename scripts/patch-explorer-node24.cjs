/**
 * Idempotent Node-24 local patches for Lattice explorer deps.
 *
 * 1) @sentry/profiling-node — wrap native binding load in try/catch so missing
 *    ABI 137 prebuilds do not crash (shim still used as belt-and-suspenders).
 * 2) @latticexyz/store-sync sqlite adapter — better-sqlite3 transactions must be
 *    synchronous; convert async transaction callbacks + awaited selects to sync.
 *
 * Dev/local only. Re-run after reinstalls (via scripts/run-explorer.sh).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const MARKER = "/* patched-by:patch-explorer-node24 */";

function patchSentry() {
  const filePath = path.join(
    root,
    "node_modules/.pnpm/@sentry+profiling-node@1.3.5_@sentry+node@7.120.1/node_modules/@sentry/profiling-node/lib/index.js",
  );
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-explorer-node24] skip sentry: not found ${filePath}`);
    return;
  }
  const before = fs.readFileSync(filePath, "utf8");
  if (before.includes(MARKER)) {
    return;
  }
  const find = "var PrivateCpuProfilerBindings = importCppBindingsModule();";
  if (!before.includes(find)) {
    console.warn("[patch-explorer-node24] skip sentry: pattern not found");
    return;
  }
  const replace = `var PrivateCpuProfilerBindings = (() => {
  ${MARKER}
  try {
    return importCppBindingsModule();
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[sentry-profiling] native profiler unavailable; continuing without CPU profiling:", err && err.message ? err.message : err);
    }
    return {
      startProfiling() {},
      stopProfiling() { return null; },
    };
  }
})();`;
  fs.writeFileSync(filePath, before.replace(find, replace));
  console.log("[patch-explorer-node24] patched sentry profiling bindings");
}

function patchStoreSyncSqlite() {
  const filePath = path.join(
    root,
    "node_modules/.pnpm/@latticexyz+store-sync@2.2.23-e1c2958b99c9fe4c7189ab24938e0978ff85a75f_@aws-sdk+client-_6874a2e2720c515a19f7aa8d44b89aad/node_modules/@latticexyz/store-sync/dist/sqlite/index.js",
  );
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-explorer-node24] skip store-sync: not found ${filePath}`);
    return;
  }
  let src = fs.readFileSync(filePath, "utf8");
  const doneMarker = "/* patched-by:patch-explorer-node24 sqlite-sync-tx */";
  let changed = false;

  // Repair older broken marker that left `sqlite-sync-tx` as executable code.
  if (src.includes("/* patched-by:patch-explorer-node24 */ sqlite-sync-tx")) {
    src = src.replaceAll(
      "/* patched-by:patch-explorer-node24 */ sqlite-sync-tx",
      doneMarker,
    );
    changed = true;
  }

  // Sync transaction callbacks (async always returns a Promise → better-sqlite3 throws).
  if (src.includes("await database.transaction(async (tx) => {")) {
    src = src.replaceAll(
      "await database.transaction(async (tx) => {",
      `${doneMarker}\n    database.transaction((tx) => {`,
    );
    changed = true;
  }

  const awaitSelect =
    "(await tx.select().from(sqlTable).where(eq(sqlTable.__key, uniqueKey)).execute())[0]";
  const syncSelect = "tx.select().from(sqlTable).where(eq(sqlTable.__key, uniqueKey)).all()[0]";
  if (src.includes(awaitSelect)) {
    src = src.replaceAll(awaitSelect, syncSelect);
    changed = true;
  }

  if (!changed) {
    if (!src.includes(doneMarker)) {
      console.warn("[patch-explorer-node24] skip store-sync: expected patterns not found");
    }
    return;
  }

  if (!src.includes(doneMarker)) {
    src = `${doneMarker}\n` + src;
  }

  fs.writeFileSync(filePath, src);
  console.log("[patch-explorer-node24] patched store-sync sqlite transactions");
}

patchSentry();
patchStoreSyncSqlite();
