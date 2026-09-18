import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { coreWebBuildCacheRoot } from "../cache-root.js";
import { insideNodeModules } from "../node-modules-root.js";

test("the cache belongs to the Core, so every worktree beside it resolves the same directory", () => {
  const core = path.resolve("F:/fxwork/!FluxIQ");
  // `.tmp/` is already in Core's .gitignore: a cache the shared Core's `git
  // status` could see would make it look dirty, and a dirty Core refuses the
  // move that keeps it current (scripts/worktree/shared-core-move.mjs).
  assert.equal(coreWebBuildCacheRoot(core, {}), path.join(core, ".tmp", "core-web-build"));
});

test("the default never runs through node_modules, where Turbopack aborts the build", () => {
  // Measured 2026-09-18: <core>/node_modules/.core-web-build crashed every
  // build with exit 3221225501; the same build elsewhere succeeded.
  assert.equal(insideNodeModules(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", {})), false);
});

test("a Core-paired task's nested Core gets a cache of its own, because it is a different Core", () => {
  assert.notEqual(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", {}), coreWebBuildCacheRoot("F:/fxwork/t012/!FluxIQ", {}));
});

test("FLUXIQ_CORE_WEB_BUILD_CACHE overrides it, which is how a too-long path is escaped", () => {
  assert.equal(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", { FLUXIQ_CORE_WEB_BUILD_CACHE: "F:/fxcache" }), path.resolve("F:/fxcache"));
  assert.equal(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", { FLUXIQ_CORE_WEB_BUILD_CACHE: "   " }), path.join(path.resolve("F:/fxwork/!FluxIQ"), ".tmp", "core-web-build"));
});
