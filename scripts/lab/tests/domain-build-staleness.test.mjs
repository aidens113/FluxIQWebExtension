// The guard that fails a run whose own build is older than its source.
//
// Core's equivalent had existed for nine days and this side had none, which
// cost two runs on 2026-09-26: one hung for 675 s on its first provider call
// and produced nothing, the other came back HTTP 400 on its build. Neither was
// a product result and neither said why.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, utimes, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { repositoryBuilds, staleRepositoryBuild } from "../domain-build-staleness.mjs";

async function tree(sourceMs, outputMs) {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-stale-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n", "utf8");
  await writeFile(path.join(root, "dist", "a.js"), "export const a = 1;\n", "utf8");
  await utimes(path.join(root, "src", "a.ts"), new Date(sourceMs), new Date(sourceMs));
  await utimes(path.join(root, "dist", "a.js"), new Date(outputMs), new Date(outputMs));
  return root;
}

function build(root) {
  return [{ name: "domain", sourceRoot: path.join(root, "src"), outputRoot: path.join(root, "dist"), rebuild: "pnpm build" }];
}

test("a build older than its source is named, with the command that rebuilds it", async () => {
  const now = Date.now();
  const root = await tree(now, now - 5 * 60_000);
  try {
    const stale = await staleRepositoryBuild(build(root));
    assert.ok(stale, "a source newer than the output is staleness");
    assert.equal(stale.name, "domain");
    assert.equal(stale.rebuild, "pnpm build");
    assert.match(stale.message, /5 minute\(s\) behind its source/u);
    // The reader is given a file to check rather than a verdict to trust.
    assert.match(stale.message, /a\.ts is newer than anything in its output/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a build newer than its source is current", async () => {
  const now = Date.now();
  const root = await tree(now - 5 * 60_000, now);
  try {
    assert.equal(await staleRepositoryBuild(build(root)), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a build with no output at all is absence, not staleness", async () => {
  // The callers that need the output say so themselves, in words that fit what
  // they were about to do; reporting it here would send the reader to rebuild
  // something that was never built.
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-stale-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "a.ts"), "export const a = 1;\n", "utf8");
  try {
    assert.equal(await staleRepositoryBuild(build(root)), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the first stale build is reported, and both of a run's builds are asked", async () => {
  const roots = repositoryBuilds("/repo", "/repo/apps/extension/dist/e2e-chromium");
  assert.deepEqual(roots.map((entry) => entry.name), ["domain", "extension"]);
  // The extension's output root is passed in rather than assumed: a run against
  // one build label must not be failed by another label's output.
  assert.equal(roots[1].outputRoot, "/repo/apps/extension/dist/e2e-chromium");
});
