import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listScenarios } from "../registry.js";
import { REALISTIC_SITE_LIVE_TASKS } from "../scenarios/index.js";

test("all realistic workflow recordings have separate authored demonstration descriptions", () => {
  const sites = new Set(REALISTIC_SITE_LIVE_TASKS.map(task => task.scenarioId));
  const instructions = new Set(REALISTIC_SITE_LIVE_TASKS.map(task => task.instruction));
  let count = 0;
  for (const scenario of listScenarios().filter(scenario => sites.has(scenario.id))) {
    for (const workflowId of [undefined, ...(scenario.manifest.workflows ?? []).map(workflow => workflow.id)]) {
      const workflow = resolveScenarioWorkflow(scenario.manifest, workflowId === undefined ? {} : { workflowId });
      assert.equal(typeof workflow.recordingDescription, "string");
      assert.ok(workflow.recordingDescription!.trim().length > 0 && workflow.recordingDescription!.length <= 4000);
      assert.equal(instructions.has(workflow.recordingDescription!), false);
      count++;
    }
  }
  assert.equal(sites.size, 10);
  assert.equal(count, 42);
});
