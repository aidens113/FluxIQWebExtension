import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { getScenarioManifest, listScenarioManifests } from "../../registry.js";
import { LIVE_INSTRUCTION_TASKS, LIVE_REPAIR_TASKS, type LiveRepairTask } from "../index.js";

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EXPECTS = new Set(["repair", "refusal"]);
const PATCH_KINDS = new Set(["temporary_target_override"]);

/**
 * Deliberately failing rows that are neither a repair task nor a refusal task,
 * each with the reason. A row belongs here only when the manifest cannot say
 * which of the two a correct model does, so neither can be judged from it.
 */
const EXCLUDED_ROWS: Readonly<Record<string, string>> = {
  "dynamic-list/remove-a-row/rows-per-visit": "The refusal is the resolver's record rule, which will not press one row's button for another's. A model could re-point the click at the row by its text, which is a legitimate repair, and the variant declares no repaired run to judge one by. It exists to measure that no deterministic recovery survives per-visit row identifiers.",
  "basic-form/primary/timed-overlay": "The refusal is the actionability gate's, as member-directory's support drawer is: dismissing the interstitial and pressing Submit again is a legitimate repair a model could propose, and the variant declares no repaired run to judge one by. It exists to measure that no deterministic rung absorbs it, which the row's own recovery declaration states.",
  "delayed-ui/primary/too-slow": "The content still arrives, twenty seconds late, so a longer wait is a legitimate repair, yet the variant declares the unrepaired timeout as its outcome. A refusal task would fail a correct wait-and-retry proposal, and a repair task has no repaired run to judge by.",
  "intermediate-state/primary/unannounced": "The manifest does not say whether ticking and continuing past a confirmation step the recording never saw is an acceptable repair or a trap, so neither outcome can be judged.",
  "member-directory/remove-invitations/support-drawer": "The refusal this row declares is the actionability gate's. Closing the support widget and pressing Remove again is a legitimate repair a model could propose, and the variant declares no repaired run to judge it by.",
  // Measured provider-free on 2026-09-17 (run-mu4zicud-5a23f269): the Flow lane stopped at the recording step.
  "sensitive-input/extract-card-secrets/-": "The refusal is the extension's, while the Flow lane records the extract step: the unlock code is a password control, so the recording stops and no Flow is ever built, and a repair task has no failing Flow run for a model to be consulted on. The model-facing side of this fixture is the creation task that leaves the codes out.",
};

type Expected = WebScenario["expected"];
type CorpusRow = { key: string; expected: Expected; recordingScript: WebScenario["recordingScript"]; variantId: string | undefined };

const rowKey = (scenarioId: string, workflowId: string | undefined, variantId: string | undefined) => `${scenarioId}/${workflowId ?? "primary"}/${variantId ?? "-"}`;
const taskKey = (task: LiveRepairTask) => rowKey(task.scenarioId, task.workflowId, task.variantId);

function resolveTask(task: LiveRepairTask) {
  const manifest = getScenarioManifest(task.scenarioId);
  assert.ok(manifest, `${task.id}: no scenario ${task.scenarioId}`);
  const selection = { ...(task.workflowId === undefined ? {} : { workflowId: task.workflowId }), ...(task.variantId === undefined ? {} : { variantId: task.variantId }) };
  return resolveScenarioWorkflow(manifest, selection);
}

/** Every workflow of every scenario, unarmed and with each of its variants. */
function corpusRows(): CorpusRow[] {
  return listScenarioManifests().flatMap((manifest) => [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows!.find(({ id }) => id === workflowId)!;
    return [undefined, ...(workflow.variants ?? []).map(({ id }) => id)].map((variantId) => {
      const selection = { ...(workflowId === undefined ? {} : { workflowId }), ...(variantId === undefined ? {} : { variantId }) };
      const { expected, recordingScript } = resolveScenarioWorkflow(manifest, selection);
      return { key: rowKey(manifest.id, workflowId, variantId), expected, recordingScript, variantId };
    });
  }));
}

/** Whether a page fact says a control the recording targets by test id is no longer on the page. */
function recordedTargetGone(expected: Expected, recordingScript: WebScenario["recordingScript"]): boolean {
  const recorded = new Set(recordingScript.flatMap(({ target }) => (target?.startsWith("testid:") ? [target.slice("testid:".length)] : [])));
  return (expected.pageFacts ?? []).some(({ subject, predicate, value }) => predicate === "exists" && value === false && recorded.has(subject));
}

/** A row the recorded Flow cannot pass: one declared to fail, or an armed drift that removed a recorded control. */
function failsDeliberately(row: CorpusRow): boolean {
  return row.expected.failure !== undefined || (row.variantId !== undefined && recordedTargetGone(row.expected, row.recordingScript));
}

test("the repair list is non-empty and frozen, and its ids are unique, kebab-case and apart from the instruction catalog's", () => {
  assert.ok(LIVE_REPAIR_TASKS.length > 0);
  assert.ok(Object.isFrozen(LIVE_REPAIR_TASKS));
  const ids = LIVE_REPAIR_TASKS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(", ")}`);
  const instructionIds = new Set(LIVE_INSTRUCTION_TASKS.map(({ id }) => id));
  for (const task of LIVE_REPAIR_TASKS) {
    assert.match(task.id, KEBAB_ID, task.id);
    assert.ok(!instructionIds.has(task.id), `${task.id}: also an instruction task id, so the campaign could not tell them apart`);
    assert.ok(Object.isFrozen(task), task.id);
  }
});

test("every repair task names a registered scenario, workflow and variant, one task per row", () => {
  const keys = LIVE_REPAIR_TASKS.map(taskKey);
  assert.equal(new Set(keys).size, keys.length, `two tasks for one row: ${keys.filter((key, index) => keys.indexOf(key) !== index).join(", ")}`);
  for (const task of LIVE_REPAIR_TASKS) {
    assert.equal(task.kind, "repair", task.id);
    assert.ok(EXPECTS.has(task.expect), `${task.id}: unknown expectation ${task.expect}`);
    assert.ok(task.description.trim().length >= 20, `${task.id}: the description is too short to say what broke`);
    const { expected } = resolveTask(task);
    if (task.variantId === undefined) assert.ok(task.workflowId !== undefined && expected.failure !== undefined, `${task.id}: without a variant, the task's workflow must itself declare the failure`);
  }
});

test("a repair task's row can only pass through a repair of its patch kind", () => {
  const repairs = LIVE_REPAIR_TASKS.filter(({ expect }) => expect === "repair");
  assert.ok(repairs.length > 0, "the list holds no task a correct model repairs");
  for (const task of repairs) {
    assert.ok(task.patchKind !== undefined && PATCH_KINDS.has(task.patchKind), `${task.id}: a repair task names a known patch kind`);
    assert.ok(task.variantId !== undefined, `${task.id}: a repair runs against a drifted variant`);
    const { expected, recordingScript } = resolveTask(task);
    assert.equal(expected.failure, undefined, `${task.id}: the row's expectations must be the repaired run's, with no failure`);
    assert.ok(recordedTargetGone(expected, recordingScript), `${task.id}: the variant must declare that a control the recording targets is gone, or the recorded Flow could pass it without a model`);
    assert.ok((expected.finalState ?? []).length > 0, `${task.id}: an executed repair is judged by the declared final state`);
  }
});

test("a refusal task's row is declared to fail, and declares the final state that shows nothing was done", () => {
  const refusals = LIVE_REPAIR_TASKS.filter(({ expect }) => expect === "refusal");
  assert.ok(refusals.length > 0, "the list holds no task a correct model refuses");
  for (const task of refusals) {
    assert.equal(task.patchKind, undefined, `${task.id}: a refusal names no patch kind`);
    const { expected } = resolveTask(task);
    assert.ok(expected.failure, `${task.id}: the recorded Flow must be declared to fail on this row`);
    assert.ok((expected.finalState ?? []).length > 0, `${task.id}: a refusal is judged by a declared final state`);
  }
});

test("every deliberately failing row of the corpus is a repair task, a refusal task, or an exclusion with its reason", () => {
  const failing = corpusRows().filter(failsDeliberately).map(({ key }) => key);
  assert.ok(failing.length > 0);
  const tasks = new Set(LIVE_REPAIR_TASKS.map(taskKey));
  const excluded = new Set(Object.keys(EXCLUDED_ROWS));
  assert.deepEqual(failing.filter((key) => !tasks.has(key) && !excluded.has(key)), [], "unclassified failing rows: add a task, or an exclusion saying why neither outcome can be judged");
  assert.deepEqual(failing.filter((key) => tasks.has(key) && excluded.has(key)), [], "rows both tasked and excluded");
  assert.deepEqual([...tasks].filter((key) => !failing.includes(key)), [], "tasks on rows the recorded Flow can pass");
  assert.deepEqual([...excluded].filter((key) => !failing.includes(key)), [], "stale exclusions");
  for (const [key, reason] of Object.entries(EXCLUDED_ROWS)) assert.ok(reason.length >= 40, `${key}: an exclusion needs its reason`);
});
