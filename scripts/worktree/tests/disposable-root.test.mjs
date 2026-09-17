import assert from "node:assert/strict";
import test from "node:test";
import { assertDisposable } from "../disposable-root.mjs";

const BASE = "F:/fxwork";
const REPO = "F:/!FluxIQWebExtension";
const WORKING = ["F:/!FluxIQ"];
const check = (root, overrides = {}) => assertDisposable({ base: BASE, root, repositoryRoot: REPO, workingRoots: WORKING, ...overrides });
const posix = (value) => value.replaceAll("\\", "/");

test("a path below the disposable base is allowed, and comes back resolved", () => {
  assert.equal(posix(check("F:/fxwork/task-a")), "F:/fxwork/task-a");
  assert.equal(posix(check("F:/fxwork/nested/task-a")), "F:/fxwork/nested/task-a");
});

test("the disposable base itself is refused, so a missing name cannot delete every worktree", () => {
  assert.throws(() => check("F:/fxwork"), /is the disposable base itself/u);
  assert.throws(() => check("F:/fxwork/"), /is the disposable base itself/u);
});

test("a path outside the base is refused first, including a checkout and a sibling sharing the prefix", () => {
  assert.throws(() => check("F:/elsewhere/task-a"), /is not below the disposable base/u);
  assert.throws(() => check("F:/fxwork-old/task-a"), /is not below the disposable base/u);
  assert.throws(() => check("F:/fxwork/../task-a"), /is not below the disposable base/u);
  assert.throws(() => check(REPO), /is not below the disposable base/u);
});

test("inside a base wide enough to reach it, the checkout this process runs from is refused three ways", () => {
  assert.throws(() => assertDisposable({ base: "F:/", root: REPO, repositoryRoot: REPO }), /it is the checkout this process runs from/u);
  assert.throws(() => assertDisposable({ base: "F:/", root: `${REPO}/apps/extension`, repositoryRoot: REPO }), /lies inside the checkout this process runs from/u);
  assert.throws(() => assertDisposable({ base: "F:/", root: "F:/outer", repositoryRoot: "F:/outer/repo" }), /the checkout this process runs from, .*, lies inside it/u);
});

test("a working checkout is refused the same three ways", () => {
  assert.throws(() => assertDisposable({ base: "F:/", root: "F:/!FluxIQ", repositoryRoot: REPO, workingRoots: WORKING }), /it is a working checkout/u);
  assert.throws(() => assertDisposable({ base: "F:/", root: "F:/!FluxIQ/packages/fluxiq", repositoryRoot: REPO, workingRoots: WORKING }), /lies inside a working checkout/u);
  assert.throws(() => assertDisposable({ base: "F:/", root: "F:/fx", repositoryRoot: REPO, workingRoots: ["F:/fx/!FluxIQ"] }), /a working checkout, .*, lies inside it/u);
});

test("on Windows, a different spelling of a protected checkout is still that checkout", { skip: process.platform !== "win32" }, () => {
  assert.throws(() => assertDisposable({ base: "F:/", root: "f:\\!fluxiqwebextension", repositoryRoot: REPO }), /it is the checkout this process runs from/u);
  assert.throws(() => assertDisposable({ base: "F:/", root: "F:\\!FLUXIQ\\packages", repositoryRoot: REPO, workingRoots: WORKING }), /lies inside a working checkout/u);
});

test("an empty or absent working root is skipped rather than turned into a path that matches everything", () => {
  assert.equal(posix(check("F:/fxwork/task-a", { workingRoots: ["", null, undefined] })), "F:/fxwork/task-a");
  assert.equal(posix(assertDisposable({ base: BASE, root: "F:/fxwork/task-a", repositoryRoot: REPO })), "F:/fxwork/task-a");
});
