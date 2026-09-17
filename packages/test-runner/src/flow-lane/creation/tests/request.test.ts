import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { loadLiveInstructionTasks } from "../instruction-catalog.js";
import { describeCreatedFlowRequest, loadCreatedFlowRequest, resolveCreatedFlowRequest } from "../request.js";
import { catalogScenario, datasetTask, goalTask } from "./scenario-fixture.js";

/**
 * What a created-Flow run builds and how it is judged is decided before any
 * topology or grant exists. The catalog task has no workflow id, so the
 * workflow is the one that extracts the task's dataset; a variant is the
 * task's own; and a task the scenario cannot judge is a fixture defect.
 */

test("a playback-goal task is judged on the primary workflow, with its variant", () => {
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ variantId: "text-variant" }));
  assert.equal(request.workflowId, undefined);
  assert.equal(request.variantId, "text-variant");
  assert.deepEqual(request.judgement, { judgeBy: "playback-goal", goalId: "catalog-goal" });
});

test("a dataset task finds the workflow whose script extracts its dataset, primary or secondary", () => {
  const primary = resolveCreatedFlowRequest(catalogScenario, datasetTask());
  assert.equal(primary.workflowId, undefined);
  assert.deepEqual(primary.judgement, { judgeBy: "expected-dataset", stepId: "extract-page-one", stepIndex: 1 });
  const secondary = resolveCreatedFlowRequest(catalogScenario, datasetTask({ expectedDatasetId: "extract-all-pages", variantId: "short-catalog" }));
  assert.equal(secondary.workflowId, "paginated-extraction");
  assert.equal(secondary.variantId, "short-catalog");
  assert.deepEqual(secondary.judgement, { judgeBy: "expected-dataset", stepId: "extract-all-pages", stepIndex: 0 });
  // An explicit --workflow must be the one that extracts it.
  assert.equal(resolveCreatedFlowRequest(catalogScenario, datasetTask({ expectedDatasetId: "extract-all-pages" }), { workflowId: "paginated-extraction" }).workflowId, "paginated-extraction");
});

test("--variant is accepted only when it is the task's own variant", () => {
  assert.equal(resolveCreatedFlowRequest(catalogScenario, datasetTask({ variantId: "text-variant" }), { variantId: "text-variant" }).variantId, "text-variant");
  assert.throws(() => resolveCreatedFlowRequest(catalogScenario, datasetTask({ variantId: "text-variant" }), { variantId: "broken" }), /names variant text-variant, not --variant broken/u);
  assert.throws(() => resolveCreatedFlowRequest(catalogScenario, datasetTask(), { variantId: "text-variant" }), /names no variant, so --variant text-variant does not apply/u);
});

test("a task the scenario cannot judge is refused as a fixture defect", () => {
  const { playbackGoal: _goal, ...goalless } = catalogScenario;
  // The scenario contract refuses such an expectation; the resolver refuses it too, rather than trusting that it ran.
  const unjudged = { ...catalogScenario, workflows: [...catalogScenario.workflows ?? [], { id: "unjudged", description: "", recordingScript: [{ id: "extract-shape-only", operation: "extract" as const, target: "testid:card", fields: { name: "testid:name" } }], expected: { extracted: [{ step: "extract-shape-only", optionalFields: ["name"] }] } }] };
  const cases: Array<[() => unknown, RegExp]> = [
    [() => resolveCreatedFlowRequest(catalogScenario, datasetTask({ scenarioId: "data-table" })), /belongs to scenario data-table, not product-catalog/u],
    [() => resolveCreatedFlowRequest(goalless, goalTask()), /playback goal the scenario does not declare/u],
    [() => resolveCreatedFlowRequest(catalogScenario, goalTask(), { workflowId: "paginated-extraction" }), /--workflow does not apply/u],
    [() => resolveCreatedFlowRequest(catalogScenario, goalTask({ variantId: "broken" })), /expects the run to fail/u],
    [() => resolveCreatedFlowRequest(catalogScenario, goalTask({ variantId: "missing" })), /names variant missing, which its workflow does not declare/u],
    // A variant of another workflow does not resolve on the dataset's own.
    [() => resolveCreatedFlowRequest(catalogScenario, datasetTask({ variantId: "short-catalog" })), /names variant short-catalog, which its workflow does not declare/u],
    [() => resolveCreatedFlowRequest(catalogScenario, datasetTask({ expectedDatasetId: "extract-nowhere" })), /which no workflow of the scenario extracts/u],
    [() => resolveCreatedFlowRequest(catalogScenario, datasetTask(), { workflowId: "paginated-extraction" }), /which no selected workflow of the scenario extracts/u],
    [() => resolveCreatedFlowRequest(unjudged, datasetTask({ expectedDatasetId: "extract-shape-only" })), /declares neither records nor a count/u],
    [() => resolveCreatedFlowRequest({ ...catalogScenario, expected: {} }, datasetTask()), /which its workflow expects nothing of/u],
  ];
  for (const [resolve, message] of cases) {
    assert.throws(resolve, (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && message.test(error.message), String(message));
  }
});

test("a dry run describes the request by identifiers, size and digest, never by its instruction", () => {
  const task = datasetTask({ variantId: "text-variant" });
  const description = describeCreatedFlowRequest(resolveCreatedFlowRequest(catalogScenario, task));
  assert.deepEqual(description, {
    taskId: "catalog-first-page",
    scenarioId: "product-catalog",
    kind: "extract",
    workflowId: null,
    variantId: "text-variant",
    judgement: { judgeBy: "expected-dataset", stepId: "extract-page-one", stepIndex: 1 },
    instruction: { characters: task.instruction.length, sha256: createHash("sha256").update(task.instruction, "utf8").digest("hex") },
  });
  assert.equal(JSON.stringify(description).includes("Scrape"), false);
});

test("the catalog and the scenario are read from the run's own scenario lab build", async (t) => {
  const dist = await mkdtemp(path.join(os.tmpdir(), "fluxiq-created-flow-catalog-"));
  t.after(() => rm(dist, { recursive: true, force: true }));
  await assert.rejects(loadLiveInstructionTasks(dist), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /live instruction catalog is not built/u.test(error.message));
  await mkdir(path.join(dist, "scenarios"), { recursive: true });
  await writeFile(path.join(dist, "scenarios", "live-instructions.js"), "export const SOMETHING_ELSE = [];\n");
  await assert.rejects(loadLiveInstructionTasks(dist), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid" && /does not export LIVE_INSTRUCTION_TASKS/u.test(error.message));

  // A fresh build directory, so the module cache cannot hand back the file above.
  const built = path.join(dist, "built");
  await mkdir(path.join(built, "scenarios"), { recursive: true });
  await writeFile(path.join(built, "scenarios", "live-instructions.js"), `export const LIVE_INSTRUCTION_TASKS = Object.freeze(${JSON.stringify([goalTask(), datasetTask({ variantId: "text-variant" })])});\n`);
  await writeFile(path.join(built, "registry.js"), `export function listScenarioManifests() { return [${JSON.stringify(catalogScenario)}]; }\n`);
  const request = await loadCreatedFlowRequest({ repositoryRoot: dist, scenarioLabDist: built, scenarioId: "product-catalog", taskId: "catalog-first-page", variantId: "text-variant" });
  assert.equal(request.task.id, "catalog-first-page");
  assert.equal(request.variantId, "text-variant");
  // The scenario's first task, when none is named.
  assert.equal((await loadCreatedFlowRequest({ repositoryRoot: dist, scenarioLabDist: built, scenarioId: "product-catalog" })).task.id, "catalog-sign-in");
});
