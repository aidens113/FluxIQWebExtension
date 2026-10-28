import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateScenarioDemonstration, type ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import { getScenarioManifest } from "../../registry.js";
import { REALISTIC_SITE_DEMONSTRATIONS } from "../realistic-site-demonstrations.js";
import { REALISTIC_SITE_LIVE_TASKS } from "../realistic-site-live-tasks.js";

/** The task a demonstration belongs to and the workflow whose extract step is the task's expected dataset. */
function subjectOf(demonstration: ScenarioDemonstration) {
  const task = REALISTIC_SITE_LIVE_TASKS.find(({ id }) => id === demonstration.taskId);
  assert.ok(task?.expectedDatasetId, `${demonstration.taskId} is a task with an expected dataset`);
  const manifest = getScenarioManifest(task.scenarioId);
  assert.ok(manifest, `${task.scenarioId} has a manifest`);
  const workflow = (manifest.workflows ?? []).map(({ id }) => resolveScenarioWorkflow(manifest, { workflowId: id }))
    .find((candidate) => candidate.expected.extracted?.some(({ step }) => step === task.expectedDatasetId));
  assert.ok(workflow, `a workflow of ${task.scenarioId} extracts ${task.expectedDatasetId}`);
  const records = workflow.expected.extracted!.find(({ step }) => step === task.expectedDatasetId)!.records ?? [];
  return { task, recordValues: records.flatMap((record) => Object.values(record)).filter((value): value is string => typeof value === "string") };
}

test("the demonstrations cover the three tasks, each with a conflicting one only for the free hubs", () => {
  const positive = REALISTIC_SITE_DEMONSTRATIONS.filter((demonstration) => !demonstration.conflictsWithInstruction).map(({ taskId }) => taskId).sort();
  assert.deepEqual(positive, ["crossborder-marketplace-free-hubs-under-ten", "everything-store-coupon-earbuds-rated-four", "job-board-remote-easy-apply"]);
  assert.deepEqual(REALISTIC_SITE_DEMONSTRATIONS.filter((demonstration) => demonstration.conflictsWithInstruction).map(({ taskId }) => taskId), ["crossborder-marketplace-free-hubs-under-ten"]);
  assert.equal(new Set(REALISTIC_SITE_DEMONSTRATIONS.map(({ id }) => id)).size, REALISTIC_SITE_DEMONSTRATIONS.length);
});

for (const demonstration of REALISTIC_SITE_DEMONSTRATIONS) {
  test(`${demonstration.id} satisfies the demonstration contract`, () => {
    const { task, recordValues } = subjectOf(demonstration);
    const result = validateScenarioDemonstration(demonstration, { instruction: task.instruction, expectedDatasetId: task.expectedDatasetId!, recordValues });
    assert.deepEqual(result.valid ? [] : result.issues, []);
    assert.equal(demonstration.scenarioId, task.scenarioId);
  });
}
