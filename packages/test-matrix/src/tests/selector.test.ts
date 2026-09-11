import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadScenarioCatalog, selectChangedCapabilities, type ScenarioCatalog } from "../index.js";

const catalog = await loadScenarioCatalog();
const allIds = catalog.map(({ id }) => id).sort();

test("documentation-only changes require only the static gate", () => {
  const result = selectChangedCapabilities(["docs/architecture/testing.md"], catalog);
  assert.deepEqual(result.requiredGates, ["static"]);
  assert.deepEqual(result.scenarioIds, []);
});

test("selects a single known fixture scenario", () => {
  const result = selectChangedCapabilities([path.win32.join("apps", "scenario-lab", "src", "scenarios", "basic-form", "scenario.ts")], catalog);
  assert.deepEqual(result.scenarioIds, ["basic-form"]);
  assert.ok(result.requiredGates.includes("changed-scenarios"));
});

test("maps content targeting changes through capability tags", () => {
  const result = selectChangedCapabilities(["apps/extension/src/content/targeting.ts"], catalog);
  assert.ok(result.scenarioIds.includes("ambiguous-targets"));
  assert.ok(result.scenarioIds.includes("iframe-checkout"));
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
  { id: "classified-targeting", tags: ["targeting"] },
  { id: "classified-gateway", tags: ["gateway"] },
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

test("a fixture directory the catalog does not list selects the whole catalog", () => {
  const result = selectChangedCapabilities(["apps/scenario-lab/src/scenarios/unregistered/scenario.ts"], synthetic);
  assert.deepEqual(result.scenarioIds, ["classified-gateway", "classified-targeting", "unclassified"]);
});

test("whole-corpus rules select exactly the catalog they are given", () => {
  assert.deepEqual(selectChangedCapabilities(["pnpm-lock.yaml"], synthetic).scenarioIds, ["classified-gateway", "classified-targeting", "unclassified"]);
});
