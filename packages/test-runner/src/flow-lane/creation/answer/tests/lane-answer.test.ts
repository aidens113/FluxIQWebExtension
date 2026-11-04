import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../../failure.js";
import type { AutomationStudioAuthoringMode } from "fluxiq/automation";
import { LAB_ANSWER_FIRST_AUTHORING_MODE } from "../../../../live-llm/index.js";
import type { CreatedFlowLaneAnswerOnly } from "../../lane.js";
import { FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "../../tests/fake-creation-core.js";
import { runLane } from "../../tests/lane-harness.js";
import { PAGE_ONE_RECORDS } from "../../tests/scenario-fixture.js";
import type { CreatedFlowAnswerStage, ShownAnswer } from "../index.js";

/** The mode, as Core will take it once its lane lands. */
const ANSWER_FIRST = LAB_ANSWER_FIRST_AUTHORING_MODE as unknown as AutomationStudioAuthoringMode;

/**
 * The created-Flow lane's answer stage, against a fake Core: the attempt is judged
 * before any fixture reset, a draft with a right answer stays apart from the Flow, and
 * in answer-first mode the hard rule decides what ends a task.
 */

const DIGEST = "c".repeat(64);
const draft = { status: "draft", projectId: PROJECT_ID, flowId: FLOW_ID, candidateId: "candidate.lab", revision: 2, digest: DIGEST, sourceInstructionIds: ["instruction.one"], baseDependencyDigest: "base", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "request.one", estimatedInputTokens: 10, provider: "deepseek", estimatedCostUsd: 0.03 }, trial: { verdict: "no", runId: "trial.two", codes: ["candidate.trial_no"] } };
const SESSIONS = [{ runId: "trial.two", flowId: FLOW_ID, queuedAt: 20, status: "succeeded", candidateTrial: { candidateId: "candidate.lab", revision: 2, digest: DIGEST, start: "reset", execution: "succeeded" } }];
const draftCore = (options: FakeCreationCoreOptions = {}) => fakeCreationCore({ candidateReadiness: { startReset: true }, runtimeSessions: SESSIONS, generation: { kind: "candidate-draft", candidate: draft }, ...options } as FakeCreationCoreOptions);

function stage(core: ReturnType<typeof fakeCreationCore>, input: { rows?: readonly Record<string, string>[] | null; shown?: ShownAnswer | null } = {}): CreatedFlowAnswerStage {
  const rows = input.rows === undefined ? PAGE_ONE_RECORDS : input.rows;
  return {
    readBaseline: async () => {
      core.calls.push("baseline");
      return { scenarioId: "catalog", view: {}, resetGeneration: 1, mutationSequence: 0 };
    },
    readSiteView: async () => {
      core.calls.push("site-view");
      return {};
    },
    readStoredRows: async () => {
      core.calls.push("stored-rows");
      return rows === null ? null : { extracted: [{ datasetId: "read", nodeIds: ["read"], recordCount: rows.length, storeTruncated: false, invalidCount: 0, records: rows.map((row) => ({ ...row })), nonStringValues: 0, pages: 1 }], actions: [], extractionDurationsByNode: new Map() };
    },
    chat: {
      readShownAnswer: async () => {
        core.calls.push("chat");
        return input.shown === undefined ? { form: "turn", turn: { kind: "rows", rows: { totalRows: rows?.length ?? 0, truncated: false, previewRows: rows ?? [] }, acts: [] } } : input.shown;
      },
    },
    secretValues: [],
    standIns: ["chat_turn"],
  };
}

test("in candidate mode a draft still fails the Flow chain, and its right answer is scored apart, before any reset", async () => {
  const core = draftCore();
  const { run, incomplete } = await runLane(core, { authoringMode: "candidate", answerStage: stage(core) });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.details?.code === "lab.candidate_not_promoted");
  assert.equal(incomplete[0]?.answer?.verdict, "right", "the person got the right answer");
  assert.equal(incomplete[0]?.answer?.flow, "unproven", "no Flow was promoted, so the Flow is unproven and not failed");
  assert.ok(!core.calls.includes("reset:/__control/reset"), "nothing reset the site before the answer was judged, and a draft never does");
  assert.ok(core.calls.indexOf("baseline") < core.calls.indexOf("chat"), "the baseline is recorded before the attempt acts");
});

test("answer-first: a draft with a right answer ends the task with no failure and no Flow", async () => {
  const core = draftCore();
  const { raw, incomplete } = await runLane(core, { authoringMode: ANSWER_FIRST, answerStage: stage(core) });
  const lane = await raw as CreatedFlowLaneAnswerOnly;
  assert.equal(lane.answerOnly, true);
  assert.equal(lane.build.outcome, "draft");
  assert.equal(lane.answer.verdict, "right");
  assert.equal(lane.answer.flow, "unproven");
  assert.equal(incomplete[0]?.failure, null, "the written record says nothing went wrong");
  for (const never of ["approve", "apply", "reset:/__control/reset", "run"]) assert.ok(!core.calls.includes(never), `${never} never happens for a draft`);
});

test("answer-first: a draft with wrong rows fails as the wrong answer, naming why", async () => {
  const core = draftCore();
  const { raw } = await runLane(core, { authoringMode: ANSWER_FIRST, answerStage: stage(core, { rows: [{ name: "Lamp", price: "$99" }, { name: "Desk", price: "$20" }] }) });
  await assert.rejects(raw, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && error.details?.code === "lab.answer_wrong" && JSON.stringify(error.details?.wrongBecause).includes("records"));
});

test("answer-first: a right answer that never reached the person fails", async () => {
  const core = draftCore();
  const { raw } = await runLane(core, { authoringMode: ANSWER_FIRST, answerStage: stage(core, { shown: null }) });
  await assert.rejects(raw, (error: unknown) => error instanceof RunnerFailure && error.details?.code === "lab.answer_wrong" && JSON.stringify(error.details?.wrongBecause) === JSON.stringify(["not_shown"]));
});

test("answer-first, the hard rule: a task that ends without its result fails", async () => {
  const core = draftCore();
  const { raw } = await runLane(core, { authoringMode: ANSWER_FIRST, answerStage: stage(core, { rows: null, shown: null }) });
  await assert.rejects(raw, (error: unknown) => error instanceof RunnerFailure && error.details?.code === "lab.task_ended_without_result");
});

test("a build whose budget ran out keeps its own failure and is scored as excused, not wrong", async () => {
  const core = draftCore();
  const { raw, incomplete } = await runLane(core, {
    authoringMode: ANSWER_FIRST, answerStage: stage(core, { rows: null, shown: null }),
    settle: async () => {
      throw new RunnerFailure("performance.budget", "the budget ran out");
    },
  });
  await assert.rejects(raw, (error: unknown) => error instanceof RunnerFailure && error.category === "performance.budget");
  assert.equal(incomplete[0]?.answer?.verdict, "budget_out");
});

test("with no answer stage a run states no answer, so an old run stays what it was", async () => {
  const core = draftCore();
  const { run, incomplete } = await runLane(core, { authoringMode: "candidate" });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.details?.code === "lab.candidate_not_promoted");
  assert.equal(incomplete[0]?.answer, null);
});

test("a promoted Flow's score says what its playback did, apart from the answer judged before the reset", async () => {
  const core = fakeCreationCore();
  const { run, evidence } = await runLane(core, { answerStage: stage(core) });
  const lane = await run;
  assert.equal(lane.observation.oracleVerdict, "passed");
  assert.equal(lane.answer?.verdict, "right");
  assert.equal(lane.answer?.flow, "playback_held");
  assert.ok(core.calls.indexOf("chat") < core.calls.indexOf("reset:/__control/reset"), "the attempt is judged before the fixture reset");
  assert.equal(evidence[0]?.observation.answer?.verdict, "right");
});
