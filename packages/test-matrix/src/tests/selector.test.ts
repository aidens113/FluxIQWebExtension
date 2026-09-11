import assert from "node:assert/strict";
import test from "node:test";
import { scenarioCatalog, selectChangedCapabilities } from "../index.js";

test("documentation-only changes require only the static gate", () => {
  const result = selectChangedCapabilities(["docs/architecture/testing.md"]);
  assert.deepEqual(result.requiredGates, ["static"]);
  assert.deepEqual(result.scenarioIds, []);
});

test("selects a single known fixture scenario", () => {
  const result = selectChangedCapabilities(["apps\\scenario-lab\\src\\scenarios\\basic-form\\scenario.ts"]);
  assert.deepEqual(result.scenarioIds, ["basic-form"]);
  assert.ok(result.requiredGates.includes("changed-scenarios"));
});

test("maps content targeting changes through capability tags", () => {
  const result = selectChangedCapabilities(["apps/extension/src/content/targeting.ts"]);
  assert.ok(result.scenarioIds.includes("ambiguous-targets"));
  assert.ok(result.scenarioIds.includes("iframe-checkout"));
  assert.ok(result.requiredGates.includes("browser-smoke"));
});

test("dependency changes conservatively select the full corpus", () => {
  const result = selectChangedCapabilities(["pnpm-lock.yaml"]);
  assert.equal(result.scenarioIds.length, scenarioCatalog.length);
  assert.ok(result.requiredGates.includes("full-matrix"));
});

test("unknown paths fail safe to the full browser matrix", () => {
  const result = selectChangedCapabilities(["new-area/behavior.ts"]);
  assert.equal(result.scenarioIds.length, scenarioCatalog.length);
  assert.ok(result.reasons.some(({ rule }) => rule === "safe-unknown"));
});
