import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_INSTRUCTION_TASKS } from "../../live-instructions.js";
import { WEEK_AHEAD_IMPROVEMENT } from "../improvement.js";
import { socialSchedulerManifest as manifest } from "../manifest.js";

const task = (id: string) => LIVE_INSTRUCTION_TASKS.find((candidate) => candidate.id === id);
const weekAhead = manifest.workflows?.find(({ id }) => id === "week-ahead");

test("the improvement starts from a Flow built on the unarmed console", () => {
  const base = task(WEEK_AHEAD_IMPROVEMENT.baseTaskId);
  assert.ok(base, "the base creation task exists");
  assert.equal(base.scenarioId, WEEK_AHEAD_IMPROVEMENT.scenarioId);
  // Built where no announcement can show, so the Flow has never seen one and
  // the improvement is the only way it learns to.
  assert.equal(base.variantId, undefined);
  assert.equal(base.variantArmedAfterBuild, undefined);
  assert.doesNotMatch(base.instruction, /announcement|What's new/iu);
});

test("the improvement is worked out on the announcement, and judged on both openings by the same dataset", () => {
  assert.ok(weekAhead?.variants?.some(({ id }) => id === WEEK_AHEAD_IMPROVEMENT.improveOnVariantId), "the variant is one of the week-ahead workflow's own");
  const base = task(WEEK_AHEAD_IMPROVEMENT.baseTaskId)!;
  const verified = WEEK_AHEAD_IMPROVEMENT.verifyTaskIds.map((id) => task(id));
  assert.equal(verified.length, 2);
  for (const judged of verified) {
    assert.ok(judged, "every verify task exists in the creation catalog");
    assert.equal(judged.scenarioId, base.scenarioId);
    assert.equal(judged.judgeBy, "expected-dataset");
    assert.equal(judged.expectedDatasetId, base.expectedDatasetId);
  }
  assert.deepEqual(verified.map((judged) => judged!.variantId).sort(), [undefined, WEEK_AHEAD_IMPROVEMENT.improveOnVariantId].sort());
});

test("both openings expect the same fourteen rows", () => {
  const unarmed = weekAhead?.expected.extracted?.find(({ step }) => step === "extract-week-ahead");
  const announcing = weekAhead?.variants?.find(({ id }) => id === "whats-new")?.expected.extracted?.find(({ step }) => step === "extract-week-ahead");
  assert.equal(unarmed?.count, 14);
  assert.equal(announcing?.count, 14);
  assert.deepEqual(announcing?.records, unarmed?.records);
});

test("the improvement is said the way a person would say it", () => {
  const { instruction } = WEEK_AHEAD_IMPROVEMENT;
  assert.ok(instruction.length > 0 && instruction.length <= 4_000, "fits one saved instruction");
  assert.doesNotMatch(instruction, /data-|testid|#|\[|\/scenarios\/|\b1\.|step \d/iu);
  assert.match(instruction, /What's new/u);
});
