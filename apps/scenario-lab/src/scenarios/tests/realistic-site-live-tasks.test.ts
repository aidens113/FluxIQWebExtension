import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { getScenarioManifest } from "../../registry.js";
import { REALISTIC_SITE_LIVE_TASKS } from "../realistic-site-live-tasks.js";
import type { LiveInstructionTask } from "../live-instructions.js";

type ExtractedEntry = NonNullable<WebScenario["expected"]["extracted"]>[number];

/**
 * The dataset a realistic site's task is judged by, resolved the way the
 * created-Flow lane resolves it: the one workflow, with the task's variant
 * armed, whose expectation declares the task's dataset step.
 */
function datasetOf(task: LiveInstructionTask): ExtractedEntry {
  const manifest = getScenarioManifest(task.scenarioId);
  assert.ok(manifest, `${task.id}: no scenario ${task.scenarioId}`);
  const workflowIds: Array<string | undefined> = [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)];
  const found: ExtractedEntry[] = [];
  for (const workflowId of workflowIds) {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    if (task.variantId !== undefined && !workflow?.variants?.some(({ id }) => id === task.variantId)) continue;
    const selection = { ...(workflowId === undefined ? {} : { workflowId }), ...(task.variantId === undefined ? {} : { variantId: task.variantId }) };
    const entry = resolveScenarioWorkflow(manifest, selection).expected.extracted?.find(({ step }) => step === task.expectedDatasetId);
    if (entry) found.push(entry);
  }
  assert.equal(found.length, 1, `${task.id}: dataset ${task.expectedDatasetId} resolves in ${found.length} workflows`);
  return found[0]!;
}

const DATASET_TASKS = REALISTIC_SITE_LIVE_TASKS.filter(({ judgeBy }) => judgeBy === "expected-dataset");

/**
 * A live run on a realistic site is scarce, so its judgement must be one a
 * wrong table cannot pass. The general corpus accepts a dataset that states
 * only a count; a realistic site's may not, because a Flow that read the
 * unfiltered first page can have exactly the right number of rows.
 */
test("every realistic-site dataset task is judged record by record, never by a count alone", () => {
  assert.ok(DATASET_TASKS.length > 0);
  for (const task of DATASET_TASKS) {
    const dataset = datasetOf(task);
    assert.ok(Array.isArray(dataset.records), `${task.id}: dataset ${task.expectedDatasetId} declares no records, so a table of the right length with the wrong rows would pass`);
    if (dataset.count !== undefined) assert.equal(dataset.count, dataset.records.length, `${task.id}: the declared count disagrees with the records`);
  }
});

/**
 * The person names the table's columns; the judge compares the records'
 * keys. A key the instruction never names is a column no Flow could know to
 * produce, and the run would fail on the fixture rather than on the product.
 */
test("every column a realistic-site dataset expects is named in the task's instruction", () => {
  for (const task of DATASET_TASKS) {
    const keys = new Set(datasetOf(task).records?.flatMap((record) => Object.keys(record)) ?? []);
    for (const key of keys) {
      assert.match(task.instruction, new RegExp(`\\b${key}\\b`, "u"), `${task.id}: the dataset expects a ${key} column the instruction never names`);
    }
  }
});

test("the column check rejects a dataset key the instruction does not name", () => {
  const named = (instruction: string, key: string) => new RegExp(`\\b${key}\\b`, "u").test(instruction);
  assert.equal(named("with columns name, price and url", "rating"), false);
  assert.equal(named("with columns name and mutualFriends", "mutualFriends"), true);
  assert.equal(named("with columns item and priceEach", "price"), false);
});
