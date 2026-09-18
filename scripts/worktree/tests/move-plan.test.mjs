import assert from "node:assert/strict";
import test from "node:test";
import { planSideMove } from "../move-plan.mjs";

const core = (overrides = {}) => ({
  side: "core", root: "F:/fxlab/!FluxIQ", head: "aaa", target: "bbb", dirtyLines: [],
  targetLock: "lock-1", installedLock: "lock-1", buildable: true, builtCommit: "aaa", distPresent: true, forceBuild: false,
  ...overrides,
});

test("moving Core to another commit checks out and rebuilds, and installs only for a new lockfile", () => {
  assert.deepEqual(planSideMove(core()), { side: "core", root: "F:/fxlab/!FluxIQ", from: "aaa", to: "bbb", targetLock: "lock-1", refusal: null, checkout: true, install: false, build: true });
  assert.equal(planSideMove(core({ targetLock: "lock-2" })).install, true);
});

test("a side already at its target, installed and built there, needs nothing", () => {
  const plan = planSideMove(core({ target: "aaa" }));
  assert.deepEqual([plan.checkout, plan.install, plan.build], [false, false, false]);
});

test("an interrupted earlier move is finished: no install or build marker means the step runs again", () => {
  const plan = planSideMove(core({ target: "aaa", installedLock: null, builtCommit: null }));
  assert.deepEqual([plan.checkout, plan.install, plan.build], [false, true, true]);
});

test("Core is rebuilt when its dist is missing or a rebuild is asked for, even at the built commit", () => {
  assert.equal(planSideMove(core({ target: "aaa", distPresent: false })).build, true);
  assert.equal(planSideMove(core({ target: "aaa", forceBuild: true })).build, true);
});

test("the extension side is never built here: the Lab builds it on every run", () => {
  const plan = planSideMove(core({ side: "ext", buildable: false, builtCommit: null, distPresent: true, forceBuild: true }));
  assert.equal(plan.build, false);
  assert.equal(plan.checkout, true);
});

test("uncommitted or untracked changes refuse the move and name some of them", () => {
  const plan = planSideMove(core({ dirtyLines: [" M domain/src/a.ts", "?? notes.txt", " D b.ts", " M c.ts"] }));
  assert.match(plan.refusal, /core worktree F:\/fxlab\/!FluxIQ has 4 uncommitted or untracked change\(s\)/u);
  assert.match(plan.refusal, /M domain\/src\/a\.ts; \?\? notes\.txt; D b\.ts\)/u);
  assert.doesNotMatch(plan.refusal, /c\.ts/u);
});
