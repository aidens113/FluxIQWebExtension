import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadRealisticScenarioIds, loadScenarioCatalog, selectChangedCapabilities, type ScenarioCatalog } from "../index.js";

// Compiled to packages/test-matrix/dist/tests/, four levels below the repository root.
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const catalog = await loadScenarioCatalog();
const allIds = catalog.map(({ id }) => id).sort();

test("documentation-only changes require only the static gate", () => {
  const result = selectChangedCapabilities(["docs/architecture/testing.md"], catalog);
  assert.deepEqual(result.requiredGates, ["static"]);
  assert.deepEqual(result.scenarioIds, []);
});

test("selects a single known fixture scenario", () => {
  const result = selectChangedCapabilities([path.win32.join("apps", "scenario-lab", "src", "scenarios", "job-board", "manifest.ts")], catalog);
  assert.deepEqual(result.scenarioIds, ["job-board"]);
  assert.ok(result.requiredGates.includes("changed-scenarios"));
});

test("a change to a scenario no browser job may open selects no browser scenario", () => {
  const result = selectChangedCapabilities(["apps/scenario-lab/src/scenarios/basic-form/scenario.ts"], catalog);
  assert.deepEqual(result.scenarioIds, []);
  assert.deepEqual(result.requiredGates, ["static"]);
});

test("a shared file in the scenarios directory selects every realistic scenario", () => {
  assert.deepEqual(selectChangedCapabilities(["apps/scenario-lab/src/scenarios/live-instructions.ts"], catalog).scenarioIds, allIds);
});

test("no change selects anything but the ten realistic scenarios", async () => {
  const realistic = new Set(await loadRealisticScenarioIds(repositoryRoot));
  assert.equal(realistic.size, 10);
  assert.deepEqual(allIds, [...realistic].sort());
  const paths = ["apps/extension/src/content/a.ts", "apps/extension/src/background/a.ts", "apps/extension/src/sidepanel/a.ts", "domain/src/recording/a.ts", "domain/src/actions/a.ts", "new-area/a.ts", "pnpm-lock.yaml", "apps/scenario-lab/src/scenarios/dynamic-list/scenario.ts"];
  for (const changed of paths) for (const id of selectChangedCapabilities([changed], catalog).scenarioIds) assert.ok(realistic.has(id), `${changed} selected ${id}`);
});

test("maps content targeting changes through capability tags", () => {
  const result = selectChangedCapabilities(["apps/extension/src/content/targeting.ts"], catalog);
  assert.deepEqual(result.scenarioIds, allIds);
  assert.deepEqual(result.tags, ["consent-overlay", "generated-classes", "honeypot", "iframe", "infinite-scroll", "lazy-load", "modal", "overlays", "shadow-dom"]);
  assert.ok(result.requiredGates.includes("browser-smoke"));
});

test("dependency changes conservatively select the full corpus", () => {
  const result = selectChangedCapabilities(["pnpm-lock.yaml"], catalog);
  assert.deepEqual(result.scenarioIds, allIds);
  assert.ok(result.requiredGates.includes("full-matrix"));
});

test("unknown paths fail safe to the full browser matrix", () => {
  const result = selectChangedCapabilities(["new-area/behavior.ts"], catalog);
  assert.deepEqual(result.scenarioIds, allIds);
  assert.ok(result.reasons.some(({ rule }) => rule === "safe-unknown"));
});

// A synthetic catalog pins the selection semantics independently of today's fixtures.
const synthetic: ScenarioCatalog = [
  { id: "classified-targeting", tags: ["iframe"] },
  { id: "classified-gateway", tags: ["permission"] },
  { id: "unclassified", tags: ["novel-capability"] },
];

test("a tag-selecting rule selects matching and unclassified scenarios", () => {
  const result = selectChangedCapabilities(["apps/extension/src/content/targeting.ts"], synthetic);
  assert.deepEqual(result.scenarioIds, ["classified-targeting", "unclassified"]);
});

test("rules that select without tags leave unclassified scenarios out", () => {
  assert.deepEqual(selectChangedCapabilities(["apps/scenario-lab/src/scenarios/classified-gateway/scenario.ts"], synthetic).scenarioIds, ["classified-gateway"]);
  assert.deepEqual(selectChangedCapabilities(["docs/architecture/testing.md"], synthetic).scenarioIds, []);
});

test("a fixture directory the catalog does not list selects nothing", () => {
  const result = selectChangedCapabilities(["apps/scenario-lab/src/scenarios/unregistered/scenario.ts"], synthetic);
  assert.deepEqual(result.scenarioIds, []);
  assert.deepEqual(result.requiredGates, ["static"]);
});

test("a rule naming a scenario outside the catalog never hands it out", () => {
  assert.deepEqual(selectChangedCapabilities(["apps/extension/src/sidepanel/view.ts"], synthetic).scenarioIds, []);
});

test("whole-corpus rules select exactly the catalog they are given", () => {
  assert.deepEqual(selectChangedCapabilities(["pnpm-lock.yaml"], synthetic).scenarioIds, ["classified-gateway", "classified-targeting", "unclassified"]);
});
