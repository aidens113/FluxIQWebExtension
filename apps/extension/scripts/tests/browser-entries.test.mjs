import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { browserEntryDrift } from "../browser-entries.mjs";

const repoRoot = path.resolve("/work/!FluxIQWebExtension");
const coreRoot = path.resolve("/work/!FluxIQ");
const workingDirectory = path.join(repoRoot, "apps", "extension");
const NODES_SOURCE = "packages/fluxiq/src/programs/automation-studio/nodes/index.ts";

// Metafile paths are relative to the bundler's working directory, as esbuild writes them.
const rel = (absolute) => path.relative(workingDirectory, absolute);
const bundle = (edges) => ({
  inputs: Object.fromEntries(Object.entries(edges).map(([from, to]) => [rel(from), { imports: to.map((target) => ({ path: rel(target) })) }]))
});

const content = path.join(repoRoot, "apps/extension/src/content/index.ts");
const domainClient = path.join(repoRoot, "domain/src/client/index.ts");
const nodesDist = path.join(coreRoot, "packages/fluxiq/dist/programs/automation-studio/nodes/index.js");
const parkingDist = path.join(coreRoot, "packages/fluxiq/dist/programs/automation-studio/runtime/parking/index.js");

const base = {
  workingDirectory, repoRoot, coreRoot,
  bundledEntrySources: [content],
  repositoryEntries: ["apps/extension/src/content/index.ts"],
  coreEntries: [NODES_SOURCE],
  metafiles: [bundle({ [content]: [domainClient], [domainClient]: [nodesDist], [nodesDist]: [parkingDist] })]
};

test("lists that match the bundle report nothing, and Core's internal edges are not entries", () => {
  assert.deepEqual(browserEntryDrift(base), []);
});

test("a bundle that enters Core through a module Core does not list is drift, named as source", () => {
  const drift = browserEntryDrift({ ...base, metafiles: [bundle({ [content]: [domainClient], [domainClient]: [nodesDist, parkingDist] })] });
  assert.equal(drift.length, 1);
  assert.ok(drift[0].includes("packages/fluxiq/src/programs/automation-studio/runtime/parking/index.ts"), drift[0]);
  assert.ok(drift[0].includes("domain/src/client/index.ts"), "names the importer");
});

test("an aliased Core source file is compared as it is", () => {
  const contracts = path.join(coreRoot, "packages/fluxiq/src/client-gateway/contracts.ts");
  const metafiles = [bundle({ [content]: [contracts] })];
  assert.equal(browserEntryDrift({ ...base, metafiles }).length, 1);
  assert.deepEqual(browserEntryDrift({ ...base, metafiles, coreEntries: [NODES_SOURCE, "packages/fluxiq/src/client-gateway/contracts.ts"] }), []);
});

test("this repository's entries must be exactly the bundled entries", () => {
  const popup = path.join(repoRoot, "apps/extension/src/popup/index.ts");
  const missing = browserEntryDrift({ ...base, bundledEntrySources: [content, popup] });
  assert.equal(missing.length, 1);
  assert.match(missing[0], /bundles apps\/extension\/src\/popup\/index\.ts/u);
  const extra = browserEntryDrift({ ...base, repositoryEntries: [...base.repositoryEntries, "apps/extension/src/gone/index.ts"] });
  assert.equal(extra.length, 1);
  assert.match(extra[0], /does not bundle/u);
});

test("a Core with no browser entries declared is drift", () => {
  const drift = browserEntryDrift({ ...base, coreEntries: undefined });
  assert.equal(drift.length, 1);
  assert.match(drift[0], /declares no browserBundles\.entries/u);
});
