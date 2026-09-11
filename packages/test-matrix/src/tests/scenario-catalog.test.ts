import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadScenarioCatalog, scenarioCatalogFromManifests, selectChangedCapabilities } from "../index.js";

// Compiled to packages/test-matrix/dist/tests/, four levels below the repository root.
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const scenarioLabDist = path.join(repositoryRoot, "apps", "scenario-lab", "dist");

type RegistryModule = { listScenarios: () => Array<{ id: string; manifest: { id: string; tags: string[] } }> };
type TypesModule = { scenarioIds: readonly string[] };

const registry = await import(pathToFileURL(path.join(scenarioLabDist, "registry.js")).href) as RegistryModule;
const { scenarioIds } = await import(pathToFileURL(path.join(scenarioLabDist, "types.js")).href) as TypesModule;
const catalog = await loadScenarioCatalog();

test("the catalog lists every registered scenario, in registry order", () => {
  assert.deepEqual(catalog.map(({ id }) => id), registry.listScenarios().map(({ id }) => id));
});

test("the registry registers every scenario id the Scenario Lab declares", () => {
  assert.deepEqual(catalog.map(({ id }) => id).sort(), [...scenarioIds].sort());
});

test("each catalog entry carries exactly its manifest's tags", () => {
  for (const definition of registry.listScenarios()) {
    const entry = catalog.find(({ id }) => id === definition.id);
    assert.deepEqual(entry?.tags, definition.manifest.tags, definition.id);
  }
});

test("each registered scenario is selected by a change to its own fixture directory", async () => {
  for (const { id } of catalog) {
    const fixture = `apps/scenario-lab/src/scenarios/${id}/scenario.ts`;
    await access(path.join(repositoryRoot, fixture));
    assert.deepEqual(selectChangedCapabilities([fixture], catalog).scenarioIds, [id], id);
  }
});

test("a missing Scenario Lab build is reported with the command that builds it", async () => {
  await assert.rejects(loadScenarioCatalog(path.join(repositoryRoot, "no-such-checkout")), /Scenario Lab build is missing: .*scenario-lab\.\.\. build/);
});

test("malformed registry output is rejected", () => {
  assert.throws(() => scenarioCatalogFromManifests([{ id: "a", tags: ["x"] }, { id: "a", tags: [] }]), /more than once/);
  assert.throws(() => scenarioCatalogFromManifests([{ id: "a" }]), /no string tags/);
  assert.throws(() => scenarioCatalogFromManifests([{ tags: [] }]), /no id/);
});
