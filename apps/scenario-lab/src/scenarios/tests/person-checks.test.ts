import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { getScenarioManifest } from "../../registry.js";
import { SCENARIO_PERSON_CHECKS } from "../index.js";

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
/** The Lab's runner waits at most this long for one check to go; a fixture that needs longer is a fixture to fix. */
const MAX_CLEAR_MS = 30_000;

test("each module belongs to one registered scenario and is frozen", () => {
  const ids = SCENARIO_PERSON_CHECKS.map(({ scenarioId }) => scenarioId);
  assert.deepEqual(ids, ["everything-store", "crossborder-marketplace", "bigbox-retail", "company-website"]);
  for (const module of SCENARIO_PERSON_CHECKS) {
    assert.ok(getScenarioManifest(module.scenarioId), module.scenarioId);
    assert.ok(Object.isFrozen(module) && Object.isFrozen(module.checks) && Object.isFrozen(module.handOffs), module.scenarioId);
  }
});

test("every check says what it shows and what a person does, in steps the runner knows", () => {
  for (const module of SCENARIO_PERSON_CHECKS) {
    const ids = module.checks.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length, module.scenarioId);
    assert.ok(module.checks.length > 0, `${module.scenarioId}: a module with no check has nothing for the Lab to play`);
    for (const check of module.checks) {
      const at = `${module.scenarioId}/${check.id}`;
      assert.match(check.id, KEBAB_ID, at);
      assert.ok(check.shows.trim().length >= 8, `${at}: the text a check shows must be specific enough to find only it`);
      assert.ok(check.steps.length > 0, `${at}: no step`);
      assert.ok(check.clearsWithinMs > 0 && check.clearsWithinMs <= MAX_CLEAR_MS, at);
      for (const step of check.steps) {
        assert.ok(["click", "press-and-hold", "type-answer", "press"].includes(step.action), `${at}: ${step.action}`);
        if (step.action === "type-answer") assert.ok(module.answer, `${at}: a typed answer needs the module's answer`);
      }
    }
  }
});

test("every declared hand-off names a row the scenario has, and the row's expectations fit what the person does", () => {
  for (const module of SCENARIO_PERSON_CHECKS) {
    const manifest = getScenarioManifest(module.scenarioId)!;
    const rows = module.handOffs.map(({ workflowId, variantId }) => `${workflowId ?? "primary"}/${variantId ?? "-"}`);
    assert.equal(new Set(rows).size, rows.length, `${module.scenarioId}: a row declared twice`);
    for (const row of module.handOffs) {
      const at = `${module.scenarioId}/${row.workflowId ?? "primary"}/${row.variantId ?? "-"}`;
      const selection = { ...(row.workflowId === undefined ? {} : { workflowId: row.workflowId }), ...(row.variantId === undefined ? {} : { variantId: row.variantId }) };
      const { expected } = resolveScenarioWorkflow(manifest, selection);
      assert.ok(row.because.trim().length > 20 && row.because.length <= 200, `${at}: one sentence saying which check the honest path meets`);
      if (row.person === "completes") assert.equal(expected.failure, undefined, `${at}: once the person has cleared the check, the run is judged on succeeding`);
      else assert.equal(expected.failure?.category, "user_intervention_required", `${at}: a person who declines ends the run needing a person`);
    }
  }
});
