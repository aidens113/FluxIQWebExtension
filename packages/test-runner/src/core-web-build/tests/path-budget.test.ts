import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { coreWebBuildCacheRoot } from "../cache-root.js";
import { coreWebBuildPathBudget, DEEPEST_RELATIVE_PATH } from "../path-budget.js";

/** The layout that failed: one cache per worktree, below its runs directory. */
const perWorktree = (slug: string, instance: string) => path.win32.join("F:/fxwork", slug, "test-runs", "instances", instance, ".core-web-build");

test("the worktree that failed and the one beside it that worked differ only by slug, and the check tells them apart", () => {
  // Measured 2026-09-18. t015 lost three Lab runs to a Turbopack path-length
  // error; t010, four characters shorter, worked with two characters to spare.
  const failed = coreWebBuildPathBudget(perWorktree("t015-extraction-mismatch-detail", "t015"), "win32");
  assert.deepEqual([failed.fits, failed.root, failed.longest], [false, 82, 261]);
  const worked = coreWebBuildPathBudget(perWorktree("t010-click-landing-in-place", "t010"), "win32");
  assert.deepEqual([worked.fits, worked.root, worked.longest], [true, 78, 257]);
  assert.equal(worked.allowed - worked.root, 2, "two characters of headroom is what the old layout had left");
});

test("beside its Core, the path no longer contains the slug at all, and has room to spare", () => {
  const shared = coreWebBuildPathBudget(coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", {}), "win32");
  assert.equal(shared.fits, true);
  assert.ok(shared.allowed - shared.root >= 30, `expected real headroom, got ${shared.allowed - shared.root}`);
  // The same Core serves every worktree beside it, so no slug can lengthen this.
  assert.equal(
    coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", {}),
    coreWebBuildCacheRoot("F:/fxwork/!FluxIQ", {}),
  );
});

test("only Windows has a limit this low; elsewhere nothing is refused", () => {
  const long = `/home/${"x".repeat(300)}/.core-web-build`;
  assert.equal(coreWebBuildPathBudget(long, "linux").fits, true);
  assert.equal(coreWebBuildPathBudget(long, "win32").fits, false);
});

test("the budget is the limit less the deepest path Next writes, and one separator", () => {
  const budget = coreWebBuildPathBudget("F:/x", "win32");
  assert.equal(budget.allowed, 259 - DEEPEST_RELATIVE_PATH - 1);
  assert.equal(budget.longest, "F:/x".length + 1 + DEEPEST_RELATIVE_PATH);
});
