// Core's account of one attempt as the panel reads it (`../read-task-outcome.ts`), against the contract's own type.
//
// t897: the outcome gained `replay` (how a replay of the saved Flow was checked), the reader's hand list of fields did not,
// and every attempt carrying one was refused whole: its answer turn never drew (`run-mwbadi79-d928f922`,
// `run-mwbexkqx-cf7dd640`). The fixture below sets every field the contract has, typed so a field the contract gains
// stops this file compiling until it is set here, and the reader must accept it: a new field fails this test, never the card.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioTaskAttemptNoLoopsCaught } from "@fluxiq/contracts/automation";
import type { AutomationStudioTaskOutcome } from "fluxiq/automation";
import { readTaskOutcome } from "../read-task-outcome";

const attempt = (over: Partial<AutomationStudioTaskOutcome["attempt"]> = {}): AutomationStudioTaskOutcome["attempt"] => ({
  taskId: "task.1", attemptId: "attempt.2", ordinal: 2, projectId: "p1", flowId: "flow-1", runId: "explore.2", path: "run_flow", status: "achieved",
  spend: { calls: 1, inputTokens: 10, outputTokens: 5, usd: 0.01, ms: 900 }, budget: { usd: 5 }, liveSteps: 4, loopsCaught: automationStudioTaskAttemptNoLoopsCaught(),
  startedFrom: { route: "use", attemptId: "attempt.1", stepsDigest: "a".repeat(64) }, startedAtMs: 3000, endedAtMs: 3900,
  ...over
} as AutomationStudioTaskOutcome["attempt"]);

/** Every field of the contract's outcome set: `Required` makes a field the contract gains a compile error here until it is set. */
const FULL: Required<AutomationStudioTaskOutcome> = {
  attempt: attempt(),
  result: { attemptId: "attempt.2", kind: "done_on_site", label: "confirmed", timesChecked: 1, source: "flow", acts: [{ id: "act.1", what: "Already done earlier: Post", where: "On the site", classes: ["send_or_publish"], state: "landed" }], checkedWhat: "The post, against what was asked." } as AutomationStudioTaskOutcome["result"] & object,
  saved: { state: "ready", trust: "provisional", flowId: "flow-1", savedAtMs: 3900, lastWorkedAtMs: 3900, stepsDigest: "a".repeat(64) } as AutomationStudioTaskOutcome["saved"] & object,
  comparedTo: attempt({ attemptId: "attempt.1", ordinal: 1, runId: "explore.1", path: "explore", startedAtMs: 1000, endedAtMs: 1900 }),
  provenance: { route: "ran the Flow it had saved", startedFrom: "a saved Flow of 2 steps", steps: [{ position: 1, label: "Open", from: "saved", ran: true }, { position: 2, label: "Post", from: "saved", ran: true }] },
  replay: { stood: false, deviation: "flow_not_proven" }
};

test("an outcome carrying every field the contract has reads, so its answer turn draws", () => {
  const read = readTaskOutcome(JSON.parse(JSON.stringify(FULL)));
  assert.ok(read, "the reader refused a whole contract outcome");
  assert.equal(read.attempt.attemptId, "attempt.2");
  assert.deepEqual(read.provenance, FULL.provenance);
});

test("a replay that stood on its record reads, and so does each deviation Core names", () => {
  assert.ok(readTaskOutcome({ ...FULL, replay: { stood: true } }));
  for (const deviation of ["act_not_done", "shape_differs", "step_routed"]) assert.ok(readTaskOutcome({ ...FULL, replay: { stood: false, deviation } }), deviation);
});

test("a replay verdict that is not exactly the contract's is a failed read, never a guess", () => {
  const bad: unknown[] = [null, "stood", [], { stood: true, deviation: "act_not_done" }, { stood: false }, { stood: false, deviation: "the page said so" }, { stood: false, deviation: "act_not_done", extra: 1 }, { stood: "yes" }];
  for (const replay of bad) assert.equal(readTaskOutcome({ ...FULL, replay }), undefined, JSON.stringify(replay));
});

test("a field the contract does not have is still refused", () => {
  assert.equal(readTaskOutcome({ ...FULL, unheardOf: true }), undefined);
});
