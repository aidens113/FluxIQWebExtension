import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveTaskRoots } from "../roots.mjs";

const repositoryRoot = path.resolve("F:/!FluxIQWebExtension");

test("the flat layout puts every task beside one shared Core", () => {
  // This is the whole point of the flat layout: domain/package.json resolves
  // Core to the worktree's parent, so siblings share it, and standing Core up
  // is 48.6s of a 52.6s setup.
  const first = resolveTaskRoots({ repositoryRoot, id: "t042", slug: "flow-editor" });
  const second = resolveTaskRoots({ repositoryRoot, id: "t043", slug: "recorder-fix" });

  assert.equal(first.coreRoot, second.coreRoot);
  assert.equal(path.dirname(first.extRoot), path.dirname(first.coreRoot));
  assert.equal(path.basename(first.coreRoot), "!FluxIQ");
  assert.equal(path.basename(first.extRoot), "t042-flow-editor");
  assert.equal(first.nested, false);
});

test("a Core-paired task nests so it gets a Core of its own", () => {
  const roots = resolveTaskRoots({ repositoryRoot, id: "t044", slug: "gateway-contract", core: true });

  assert.equal(roots.nested, true);
  assert.equal(path.dirname(roots.extRoot), path.dirname(roots.coreRoot));
  assert.equal(path.basename(path.dirname(roots.extRoot)), "t044");
  assert.equal(path.basename(roots.coreRoot), "!FluxIQ");
  assert.notEqual(roots.coreRoot, resolveTaskRoots({ repositoryRoot, id: "t045", slug: "other" }).coreRoot);
});

test("the Core sibling is always the extension worktree's parent, which is what the domain link requires", () => {
  for (const core of [false, true]) {
    const roots = resolveTaskRoots({ repositoryRoot, id: "t050", slug: "any", core });
    // <ext>/domain + ../../!FluxIQ resolves to <parent of ext>/!FluxIQ.
    assert.equal(path.resolve(roots.extRoot, "domain", "..", "..", "!FluxIQ"), roots.coreRoot);
  }
});

test("the disposable base defaults beside the repository, never inside it", () => {
  const roots = resolveTaskRoots({ repositoryRoot, id: "t042", slug: "x" });
  assert.equal(roots.base, path.resolve(repositoryRoot, "..", "fxwork"));
  assert.equal(roots.extRoot.startsWith(repositoryRoot + path.sep), false);
});
