import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { coreWebBuildCacheRoot } from "../cache-root.js";

test("the cache belongs to the Core, so every worktree beside it resolves the same directory", () => {
  const core = path.resolve("F:/fxwork/!FluxIQ");
  assert.equal(coreWebBuildCacheRoot(core, {}), path.join(core, "node_modules", ".core-web-build"));
  // It is inside node_modules because that is gitignored in every checkout: a
  // cache anywhere else would make the shared Core dirty, and a dirty Core
  // refuses the move that keeps it current (scripts/worktree/shared-core-move.mjs).
  assert.ok(coreWebBuildCacheRoot(core, {}).includes(`${path.sep}node_modules${path.sep}`));
});

test("a Core-paired task's nested Core gets a cache of its own, because it is a different Core", () => {
  assert.notEqual(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", {}), coreWebBuildCacheRoot("F:/fxwork/t012/!FluxIQ", {}));
});

test("FLUXIQ_CORE_WEB_BUILD_CACHE overrides it, which is how a too-long path is escaped", () => {
  assert.equal(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", { FLUXIQ_CORE_WEB_BUILD_CACHE: "F:/fxcache" }), path.resolve("F:/fxcache"));
  assert.equal(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", { FLUXIQ_CORE_WEB_BUILD_CACHE: "   " }), path.join(path.resolve("F:/fxwork/!FluxIQ"), "node_modules", ".core-web-build"));
});
