/**
 * Node preload shim for local Lattice explorer on Node 24+.
 *
 * @sentry/profiling-node@1.3.5 (pulled by @latticexyz/store-indexer) only ships
 * prebuilds through NODE_MODULE_VERSION 115 (Node 20). On Node 24 (ABI 137) it
 * hard-requires a missing .node file and crashes the explorer process.
 *
 * This shim intercepts that native require and returns no-op profiler bindings.
 * Profiling stays disabled; explorer/indexer keep running. Not for production
 * Sentry profiling — local/dev only.
 *
 * Usage: NODE_OPTIONS='--require ./scripts/sentry-profiler-shim.cjs' pnpm exec explorer
 */
"use strict";

const Module = require("module");

const stubBindings = {
  startProfiling() {},
  stopProfiling() {
    return null;
  },
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (typeof request === "string" && request.includes("sentry_cpu_profiler")) {
    return stubBindings;
  }
  return originalLoad.apply(this, arguments);
};
