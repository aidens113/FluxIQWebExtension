import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRealisticScenarioIds, loadScenarioCatalog, scenarioCatalogFromManifests, selectChangedCapabilities } from "../index.js";

// Compiled to packages/test-matrix/dist/tests/, four levels below the repository root.
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const scenarioLabDist = path.join(repositoryRoot, "apps", "scenario-lab", "dist");

type RegistryModule = { listScenarios: () => Array<{ id: string; manifest: { id: string; tags: string[] } }> };
type TypesModule = { scenarioIds: readonly string[] };

const registry = await import(pathToFileURL(path.join(scenarioLabDist, "registry.js")).href) as RegistryModule;
const { scenarioIds } = await import(pathToFileURL(path.join(scenarioLabDist, "types.js")).href) as TypesModule;
const catalog = await loadScenarioCatalog();
const realistic = await loadRealisticScenarioIds(repositoryRoot);

test("the catalog lists exactly the ten realistic scenarios, in registry order", () => {
  assert.equal(realistic.length, 10);
  assert.deepEqual(catalog.map(({ id }) => id), registry.listScenarios().map(({ id }) => id).filter((id) => realistic.includes(id)));
  assert.deepEqual(catalog.map(({ id }) => id).sort(), [...realistic].sort());
});

test("the Scenario Lab declares and registers every realistic scenario", () => {
  for (const id of realistic) assert.ok(scenarioIds.includes(id), id);
});

test("each catalog entry carries exactly its manifest's tags", () => {
  for (const definition of registry.listScenarios().filter(({ id }) => realistic.includes(id))) {
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

test("an admitted scenario the registry does not register is rejected", () => {
  assert.deepEqual(scenarioCatalogFromManifests([{ id: "a", tags: [] }, { id: "b", tags: [] }], ["b"]), [{ id: "b", tags: [] }]);
  assert.throws(() => scenarioCatalogFromManifests([{ id: "a", tags: [] }], ["a", "missing"]), /does not register the realistic scenario\(s\) missing/);
});

test("a missing realistic scenario list is reported with its path", async () => {
  await assert.rejects(loadRealisticScenarioIds(path.join(repositoryRoot, "no-such-checkout")), /realistic scenario list is missing: .*realistic-scenarios/);
});

test("malformed registry output is rejected", () => {
  assert.throws(() => scenarioCatalogFromManifests([{ id: "a", tags: ["x"] }, { id: "a", tags: [] }]), /more than once/);
  assert.throws(() => scenarioCatalogFromManifests([{ id: "a" }]), /no string tags/);
  assert.throws(() => scenarioCatalogFromManifests([{ tags: [] }]), /no id/);
});
