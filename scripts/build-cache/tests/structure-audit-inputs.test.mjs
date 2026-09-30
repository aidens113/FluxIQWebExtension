// A step marked `structureAudit` is fingerprinted over the structure audit's
// configuration and rules, in this repository and in the Core it links.
// `extension:check` holds the browser-imports rule's entry lists in both
// `config.mjs` files to the bundle, and before this an edit to either alone
// was answered from the stamp: the check that should have failed was reused.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { runStep, STEPS as REGISTRY } from "../index.mjs";

let base;
let repo;
let core;

const STEPS = {
  "a:check": { package: "packages/a", kind: "check", command: "node check.mjs", generated: [], structureAudit: true, env: [] },
  "a:plain": { package: "packages/a", kind: "check", command: "node check.mjs", generated: [], env: [] }
};

async function put(root, relative, text) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

function run(step) {
  return runStep(step, { repoRoot: repo, steps: STEPS, stdio: "ignore", env: { ...process.env, FLUXIQ_BUILD_FORCE: "", FLUXIQ_BUILD_CACHE_DIR: "off" } });
}

beforeEach(async () => {
  base = await mkdtemp(path.join(os.tmpdir(), "build-cache-audit-"));
  repo = path.join(base, "downstream");
  core = path.join(base, "core");
  await put(core, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  await put(core, "package.json", "{}");
  await put(core, "packages/lib/package.json", JSON.stringify({ name: "lib" }));
  await put(core, "packages/lib/src/index.ts", "export const lib = 1;\n");
  await put(repo, "pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  await put(repo, "package.json", "{}");
  await put(repo, "packages/a/package.json", JSON.stringify({ name: "a", dependencies: { lib: "link:../../../core/packages/lib" } }));
  await put(repo, "packages/a/check.mjs", "process.exit(0);\n");
  for (const root of [repo, core]) {
    await put(root, "scripts/structure-audit/config.mjs", "export const CONFIG = { browserBundles: { entries: [] } };\n");
    await put(root, "scripts/structure-audit/rules/browser-imports.mjs", "export const id = 'browser-imports';\n");
    await put(root, "scripts/structure-audit/rules/tests/browser-imports.test.mjs", "// test\n");
  }
});
afterEach(async () => { await rm(base, { recursive: true, force: true }); });

async function stampedThenReused(step) {
  assert.equal((await run(step)).result, "build");
  assert.equal((await run(step)).result, "reuse");
}

test("a change to this repository's structure-audit config reruns a structureAudit step", async () => {
  await stampedThenReused("a:check");
  await put(repo, "scripts/structure-audit/config.mjs", "export const CONFIG = { browserBundles: { entries: ['x.ts'] } };\n");
  const outcome = await run("a:check");
  assert.equal(outcome.result, "build");
  assert.match(outcome.reason, /scripts\/structure-audit/u);
});

test("a change to the linked Core's structure-audit config reruns it", async () => {
  await stampedThenReused("a:check");
  await put(core, "scripts/structure-audit/config.mjs", "export const CONFIG = { browserBundles: { entries: ['y.ts'] } };\n");
  const outcome = await run("a:check");
  assert.equal(outcome.result, "build");
  assert.match(outcome.reason, /core:scripts\/structure-audit/u);
});

test("a change to a rule file reruns it; a change to a rule's test does not", async () => {
  await stampedThenReused("a:check");
  await put(core, "scripts/structure-audit/rules/tests/browser-imports.test.mjs", "// test, edited\n");
  assert.equal((await run("a:check")).result, "reuse");
  await put(repo, "scripts/structure-audit/rules/browser-imports.mjs", "export const id = 'browser-imports'; // edited\n");
  assert.equal((await run("a:check")).result, "build");
});

test("a step not marked structureAudit does not read the audit", async () => {
  await stampedThenReused("a:plain");
  await put(repo, "scripts/structure-audit/config.mjs", "export const CONFIG = {};\n");
  assert.equal((await run("a:plain")).result, "reuse");
});

test("the registry marks extension:check, whose drift check reads both configs", () => {
  assert.equal(REGISTRY["extension:check"].structureAudit, true);
});
