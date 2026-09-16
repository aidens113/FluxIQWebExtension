import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { getScenarioManifest, listScenarioManifests } from "../../registry.js";
import { LIVE_INSTRUCTION_TASKS, type LiveInstructionTask } from "../index.js";

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const KINDS = new Set(["form", "navigate", "extract", "navigate-and-extract"]);

/**
 * Tokens that would make an instruction a recipe for the page's markup rather
 * than a goal a person would type. Each is named so a failure says which.
 */
const SELECTOR_LIKE: ReadonlyArray<readonly [string, RegExp]> = [
  ["a CSS id or class", /(?:^|[\s(,"'])[#.][A-Za-z_][\w-]*/u],
  ["an attribute selector", /\[[^\]]*\]/u],
  ["a data- attribute", /\bdata-[a-z]/iu],
  ["a test id", /\btest[\s_-]?ids?\b/iu],
  ["an aria- attribute", /\baria-[a-z]/iu],
  ["an attribute assignment", /\b(?:id|class|name|role|type|href|src)\s*=/iu],
  ["a markup tag", /<\/?[a-z][^>]*>/iu],
  ["a child combinator", /\w\s*>\s*[\w.#[]/u],
  ["a pseudo-class", /:(?:nth-|first-|last-|not\(|has\(|contains\(|hover\b|focus\b|checked\b)/iu],
  ["an XPath", /(?:^|\s)\/\/?[a-z*@]|\bxpath\b/iu],
  ["the word selector", /\bselectors?\b|\bcss\b|\bqueryselector/iu],
  ["a URL path", /(?:^|\s)\/[a-z][\w-]*\//iu],
  ["code formatting", /`/u],
  ["a numbered or bulleted step", /(?:^|\n)\s*(?:\d+[.)]|[-*•])\s|\bstep\s*\d/iu],
];

type WorkflowMatch = { workflowId: string | undefined; expected: WebScenario["expected"] };

/** Every workflow of `manifest` whose resolved expectation, with `variantId` armed, declares the dataset. */
function workflowsDeclaringDataset(manifest: WebScenario, task: LiveInstructionTask): WorkflowMatch[] {
  const workflowIds: Array<string | undefined> = [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)];
  const matches: WorkflowMatch[] = [];
  for (const workflowId of workflowIds) {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    if (task.variantId !== undefined && !workflow?.variants?.some(({ id }) => id === task.variantId)) continue;
    const selection = { ...(workflowId === undefined ? {} : { workflowId }), ...(task.variantId === undefined ? {} : { variantId: task.variantId }) };
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    if (expected.extracted?.some(({ step }) => step === task.expectedDatasetId)) matches.push({ workflowId, expected });
  }
  return matches;
}

test("the catalog is non-empty and every task id is unique and kebab-case", () => {
  assert.ok(LIVE_INSTRUCTION_TASKS.length > 0);
  const ids = LIVE_INSTRUCTION_TASKS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(", ")}`);
  for (const id of ids) assert.match(id, KEBAB_ID, id);
});

test("every task names a registered scenario, a known kind, and a variant that scenario declares", () => {
  for (const task of LIVE_INSTRUCTION_TASKS) {
    const manifest = getScenarioManifest(task.scenarioId);
    assert.ok(manifest, `${task.id}: no scenario ${task.scenarioId}`);
    assert.ok(KINDS.has(task.kind), `${task.id}: unknown kind ${task.kind}`);
    if (task.variantId === undefined) continue;
    const declared = [...(manifest.variants ?? []), ...(manifest.workflows ?? []).flatMap(({ variants }) => variants ?? [])].map(({ id }) => id);
    assert.ok(declared.includes(task.variantId), `${task.id}: ${task.scenarioId} declares no variant ${task.variantId}`);
  }
});

test("a playback-goal task points at a declared goal, on the primary workflow, with no expected failure", () => {
  for (const task of LIVE_INSTRUCTION_TASKS.filter(({ judgeBy }) => judgeBy === "playback-goal")) {
    const manifest = getScenarioManifest(task.scenarioId)!;
    assert.equal(task.expectedDatasetId, undefined, `${task.id}: a goal task names no dataset`);
    assert.ok(manifest.playbackGoal, `${task.id}: ${task.scenarioId} declares no playback goal`);
    assert.ok(manifest.playbackGoal.successFacts.length > 0, `${task.id}: the goal states no success fact`);
    // The goal is the manifest's, so the variant must be one the primary workflow arms.
    const { expected } = resolveScenarioWorkflow(manifest, task.variantId === undefined ? {} : { variantId: task.variantId });
    assert.equal(expected.failure, undefined, `${task.id}: the run is expected to fail, so meeting the goal cannot be the judgement`);
  }
});

test("an expected-dataset task names exactly one declared dataset, in the workflow its variant belongs to", () => {
  for (const task of LIVE_INSTRUCTION_TASKS.filter(({ judgeBy }) => judgeBy === "expected-dataset")) {
    const manifest = getScenarioManifest(task.scenarioId)!;
    assert.ok(task.expectedDatasetId, `${task.id}: a dataset task must name its dataset`);
    const matches = workflowsDeclaringDataset(manifest, task);
    assert.equal(matches.length, 1, `${task.id}: ${task.scenarioId} declares dataset ${task.expectedDatasetId} in ${matches.length} workflows${task.variantId ? ` with variant ${task.variantId}` : ""}`);
    const [{ expected }] = matches as [WorkflowMatch];
    const dataset = expected.extracted!.find(({ step }) => step === task.expectedDatasetId)!;
    assert.ok(dataset.count !== undefined || dataset.records !== undefined, `${task.id}: the dataset states neither a count nor records`);
    assert.equal(expected.failure, undefined, `${task.id}: the run is expected to fail, so the dataset cannot be the judgement`);
  }
});

test("dataset step ids are unique across a scenario's workflows, so a dataset id names its workflow", () => {
  for (const manifest of listScenarioManifests()) {
    const steps = [manifest.recordingScript, ...(manifest.workflows ?? []).map(({ recordingScript }) => recordingScript)]
      .flatMap((script) => script.filter(({ operation }) => operation === "extract").map(({ id }) => id));
    assert.equal(new Set(steps).size, steps.length, `${manifest.id}: extract step ids repeat across workflows`);
  }
});

test("every scenario that declares a playback goal or an expected dataset has at least one task", () => {
  const covered = new Set(LIVE_INSTRUCTION_TASKS.map(({ scenarioId }) => scenarioId));
  const judgeable = listScenarioManifests().filter((manifest) => {
    const expectations = [manifest.expected, ...(manifest.variants ?? []).map(({ expected }) => expected), ...(manifest.workflows ?? []).flatMap((workflow) => [workflow.expected, ...(workflow.variants ?? []).map(({ expected }) => expected)])];
    return manifest.playbackGoal !== undefined || expectations.some(({ extracted }) => (extracted ?? []).length > 0);
  });
  assert.ok(judgeable.length > 0);
  assert.deepEqual(judgeable.map(({ id }) => id).filter((id) => !covered.has(id)), []);
});

test("no instruction contains a selector, test id, element id, path or step list", () => {
  for (const task of LIVE_INSTRUCTION_TASKS) {
    assert.ok(task.instruction.trim().length >= 20, `${task.id}: the instruction is too short to be a goal`);
    for (const [label, pattern] of SELECTOR_LIKE) {
      assert.doesNotMatch(task.instruction, pattern, `${task.id}: the instruction contains ${label}`);
    }
  }
});

test("the selector check rejects the tokens it names and accepts plain goals", () => {
  const flagged = (text: string) => SELECTOR_LIKE.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  for (const recipe of [
    "Click #save-button",
    "Read every .product-card",
    "Press the button with data-testid save",
    "Use the test id catalog-next",
    "Find button[type=submit]",
    "Open ul > li",
    "Click the aria-label Save",
    "Read //div[@id='x']",
    "Use the selector for the table",
    "Go to /scenarios/data-table/ first",
    "1. Click Save\n2. Read the table",
    "Pick li:nth-child(2)",
    "Press `Save`",
  ]) {
    assert.notDeepEqual(flagged(recipe), [], recipe);
  }
  for (const goal of [
    "Scrape every product into a table with columns name, price, rating and url.",
    "Rename the workspace to Aurora Field Team and save the settings.",
    "Find the members whose name matches \"hollis\" and who are admins.",
  ]) {
    assert.deepEqual(flagged(goal), [], goal);
  }
});

test("the catalog and its tasks are frozen", () => {
  assert.ok(Object.isFrozen(LIVE_INSTRUCTION_TASKS));
  for (const task of LIVE_INSTRUCTION_TASKS) assert.ok(Object.isFrozen(task), task.id);
});
