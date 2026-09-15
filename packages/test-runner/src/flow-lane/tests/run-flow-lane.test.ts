import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedEvent, ResolvedScenarioWorkflow, ScenarioStep, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { deterministicUploadBytes } from "../../trusted-input/index.js";
import type { DeclaredSecret } from "../declared-secrets.js";
import { flowLaneSnapshot, runFlowLane, type FlowLaneControl, type FlowLaneEvidence } from "../run-flow-lane.js";

/**
 * The regression this file exists for.
 *
 * `L-dropped-action` reproduced a silently short Flow 12 times in 24 Lab runs
 * and localised it: Core keeps appending to a recording's timeline for
 * seconds after the extension has stopped recording, and the Flow lane asked
 * for a proposal about one second after the stop. Core builds a proposal from
 * whatever timeline exists at that instant and reports success, so the
 * candidate count in every failing run equalled the number of entries Core had
 * managed to append — 4, 3, 2 or none — and nothing anywhere said so.
 *
 * The Core below reproduces exactly that: its timeline grows on a virtual
 * clock, `endedAt` appears only when the last entry has landed, and
 * `create-recording-flow-proposals` answers with one candidate per entry
 * *visible at the moment it is called*. A lane that asks immediately gets one
 * candidate of four and passes its own assertions; a lane that waits for
 * Core's completion signal gets four.
 *
 * `graphNodes`, when given, are the nodes approval wrote onto the primary
 * Subflow's graph Flow, which is where recorded actions live. `lostCandidates`
 * is how many recorded entries Core's proposal leaves out even after the
 * recording is finished. `attempt` and `runStatus` shape the one action
 * attempt the run detail reports. `flowReads` lists every read of the approved
 * Flow's structure, in order.
 */
function fakeCore(options: { appendsAt: readonly number[]; finalizedAt?: number; graphNodes?: readonly unknown[]; lostCandidates?: number; attempt?: Record<string, unknown>; runStatus?: string }) {
  const clock = { value: 0 };
  const proposalRequestedAt: number[] = [];
  const reviewedProposals: string[] = [];
  const startedInputs: Record<string, unknown>[] = [];
  const runInputs: Record<string, unknown>[] = [];
  const flowReads: string[] = [];
  // The lane's steps in the order they reached Core or the page: flow reads, the start, and what `runLane` adds.
  const sequence: string[] = [];
  const visibleEntries = () => options.appendsAt.filter(at => at <= clock.value).length;
  const proposedCandidates = () => Math.max(0, visibleEntries() - (options.lostCandidates ?? 0));
  const proposal = (candidateCount: number) => ({
    proposalId: "proposal.one",
    recordingId: "recording.one",
    status: "proposed",
    generatedAt: clock.value,
    mapper: { id: "web-recording-actions", version: "0.1" },
    candidates: Array.from({ length: candidateCount }, (_value, index) => ({ candidateId: `candidate.${index}`, outputId: "web.dom.type" })),
  });
  const control: FlowLaneControl = {
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
      if (endpoint === "list-recordings") {
        const ended = options.finalizedAt !== undefined && clock.value >= options.finalizedAt;
        return { recordings: [{ recordingId: "recording.one", startedAt: 0, ...(ended ? { endedAt: options.finalizedAt } : {}), metadata: { summaryOnly: true, eventCount: visibleEntries() } }] };
      }
      if (endpoint === "create-recording-flow-proposals") {
        proposalRequestedAt.push(clock.value);
        // Core's own behaviour: it maps the timeline as it stands, and says so
        // in `issues` without failing.
        return { proposals: [proposal(proposedCandidates())], issues: ["mapped the recording as it stood"] };
      }
      if (endpoint === "review-recording-flow-proposal") {
        reviewedProposals.push(String(payload.proposalId));
        return { proposal: { ...proposal(proposedCandidates()), status: "approved", review: { decision: "approved", destination: { kind: "flow", flowId: "flow.new", created: true } } }, flow: { flowId: "flow.new" } };
      }
      if (endpoint === "get-flow") {
        flowReads.push(`get-flow:${String(payload.flowId)}`);
        sequence.push(`get-flow:${String(payload.flowId)}`);
        // Approval links each recorded node to its candidate, in candidate order:
        // `node.one` is `candidate.0` and the graph's nodes follow it. A node
        // given its own `metadata` keeps it.
        const linked = (node: unknown, index: number) => (node && typeof node === "object" && "metadata" in node ? node : { ...(node as object), metadata: { recordingCandidateId: `candidate.${index}` } });
        if (payload.flowId === "flow.graph") return { flow: { nodes: (options.graphNodes ?? []).map((node, index) => linked(node, index + 1)) } };
        return { flow: { nodes: [linked({ id: "node.one", parameterValues: { outputId: "web.dom.click" } }, 0)] } };
      }
      if (endpoint === "list-flow-subflows") {
        flowReads.push(`list-flow-subflows:${String(payload.flowId)}`);
        sequence.push(`list-flow-subflows:${String(payload.flowId)}`);
        return { subflows: options.graphNodes ? [{ graphFlowId: "flow.graph" }] : [] };
      }
      if (endpoint === "get-flow-run-detail") {
        const attempt = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "builtin.policy.action", order: 1, status: "succeeded", startedAt: 10, finishedAt: 20, ...options.attempt };
        return { runDetail: { summary: { runId: "run.one", status: options.runStatus ?? "succeeded" }, actionAttempts: [attempt], interventions: [] } };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
    selectExistingContext: async () => {},
    startPersistedFlow: async (input) => { sequence.push("start"); startedInputs.push(input.inputs ?? {}); return { runId: "run.one" }; },
    runPersistedFlow: async (input) => { runInputs.push(input.inputs ?? {}); return { session: { runId: "run.one", status: options.runStatus ?? "succeeded" } }; },
  };
  return {
    control,
    proposalRequestedAt,
    reviewedProposals,
    startedInputs,
    runInputs,
    flowReads,
    sequence,
    now: () => clock.value,
    sleep: async (ms: number) => { clock.value += ms; },
  };
}

type LaneOptions = {
  scenarioId?: string;
  secrets?: readonly DeclaredSecret[];
  recordingScript?: readonly ScenarioStep[];
  expected?: ResolvedScenarioWorkflow["expected"];
  recordingEvents?: readonly ExpectedEvent[];
  finalStateHolds?: boolean;
  variant?: ResolvedScenarioWorkflow["variant"];
  flowDispatchStarting?: (at: number) => void;
};

async function runLane(fake: ReturnType<typeof fakeCore>, evidence: FlowLaneEvidence[], lane: LaneOptions = {}) {
  const resetCalls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => { resetCalls.push(String(url)); fake.sequence.push("reset"); return { ok: true, status: 200 }; }) as unknown as typeof globalThis.fetch;
  try {
    const outcome = await runFlowLane({
      control: fake.control,
      projectId: "project.web",
      authorizationPin: "123456",
      recordingId: "recording.one",
      recordingWait: { now: fake.now, sleep: fake.sleep, intervalMs: 100, timeoutMs: 10_000 },
      scenario: { id: lane.scenarioId ?? "basic-form", recordingScript: [], expected: {} } as unknown as WebScenario,
      workflow: { expected: lane.expected ?? {}, recordingScript: lane.recordingScript ?? [], ...(lane.variant ? { variant: lane.variant } : {}) } as unknown as ResolvedScenarioWorkflow,
      recordingEvents: lane.recordingEvents ?? [],
      facilityRunId: "run-test",
      scenarioOrigin: "http://127.0.0.1:4310",
      runToken: "token",
      secrets: lane.secrets ?? [],
      prepareFlowPage: async () => { fake.sequence.push("prepare"); },
      recordEvidence: async (item) => { evidence.push(item); },
      checkFinalState: async () => lane.finalStateHolds ?? true,
      flowDispatchStarting: lane.flowDispatchStarting ?? (() => {}),
    });
    return { outcome, resetCalls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** `basic-form`'s `expected.recordingEvents`, as its manifest declares them: four executable actions. */
const basicFormEvents: ExpectedEvent[] = [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.changed", count: 1 }, { type: "web.element.clicked", count: 1 }];

test("the lane proposes from the finished recording, not from the entries Core happens to have appended", async () => {
  // One entry is already visible when the lane starts; the other three land
  // over the next 900 ms and Core finalizes at 1_500 ms.
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 });
  const evidence: FlowLaneEvidence[] = [];
  const { outcome, resetCalls } = await runLane(fake, evidence, { recordingEvents: basicFormEvents });
  assert.equal(outcome.proposal.candidateCount, 4);
  assert.equal(outcome.recording.entryCount, 4);
  assert.equal(outcome.recording.entriesAppendedWhileWaiting, 3);
  assert.equal(fake.proposalRequestedAt.length, 1);
  assert.ok((fake.proposalRequestedAt[0] ?? 0) >= 1_500, `the proposal was requested at ${String(fake.proposalRequestedAt[0])} ms, before Core finished the recording at 1500 ms`);
  assert.deepEqual(outcome.proposal.issues, ["mapped the recording as it stood"]);
  assert.equal(evidence[0]?.recording.entryCount, 4);
  assert.deepEqual(resetCalls, ["http://127.0.0.1:4310/__control/reset"]);
});

test("a recording Core never finishes fails the run, and no proposal is asked for at all", async () => {
  const fake = fakeCore({ appendsAt: [0, 300] });
  const evidence: FlowLaneEvidence[] = [];
  await assert.rejects(
    () => runLane(fake, evidence),
    (error: unknown) => error instanceof RunnerFailure && error.category === "recording.persistence",
  );
  assert.deepEqual(fake.proposalRequestedAt, [], "the lane must not propose from a recording Core never finished");
  assert.deepEqual(evidence, []);
});

/**
 * B1. The finished recording holds four entries and Core's proposal carries
 * three: the shape of a dropped second `web.dom.type`. The Flow that proposal
 * approves would run three actions green and exit 0, so the lane refuses it
 * before approval, as a recording contract.
 */
test("a proposal short of the actions the recording pins fails the run before any Flow is approved", async () => {
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, lostCandidates: 1 });
  const evidence: FlowLaneEvidence[] = [];
  await assert.rejects(
    () => runLane(fake, evidence, { recordingEvents: basicFormEvents }),
    (error: unknown) => error instanceof RunnerFailure
      && error.category === "recording.contract"
      && (error.details as { candidateCount?: unknown }).candidateCount === 3
      && (error.details as { expectedExecutableActions?: unknown }).expectedExecutableActions === 4,
  );
  assert.deepEqual(fake.reviewedProposals, [], "a short proposal is never approved");
  assert.deepEqual(fake.startedInputs, [], "and nothing runs");
  assert.deepEqual(evidence, []);
});

/**
 * F1 (`i-stage1-failures` finding (a)). The page used to be prepared only for a
 * variant, and the reset reloads nothing, so W18 -- no variant -- ran its Flow
 * on the account page its recording ended on, where no password field exists.
 * The order is the lane's: reset first, because a reset discards an arm; then
 * the page; then the one read of the Flow's nodes, and only then the run.
 */
test("every Flow run, armed or not, prepares its page once, after the reset and before the Flow is read or started", async () => {
  for (const variant of [undefined, { id: "drifted" }] as const) {
    const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 });
    await runLane(fake, [], variant ? { variant: variant as unknown as ResolvedScenarioWorkflow["variant"] } : {});
    assert.deepEqual(fake.sequence, ["reset", "prepare", "get-flow:flow.new", "list-flow-subflows:flow.new", "start"], `${variant ? "an armed" : "an unarmed"} run`);
  }
});

/**
 * D1 (`i-flow-lane-errors`). An expectation that fails throws, and it used to
 * throw before the lane had built or published its observation, so the run was
 * evaluated as a recording-lane run and the category Core reported was lost.
 * The observation, with the fixture oracle's verdict, is now published first.
 */
test("a Flow that reports the wrong category is published as the Flow run it was, with Core's category and the oracle's verdict", async () => {
  const notFound = { category: "target_not_found", code: "web.target.not_found", retryable: true };
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, runStatus: "failed", attempt: { status: "failed", failure: notFound } });
  const evidence: FlowLaneEvidence[] = [];
  await assert.rejects(
    () => runLane(fake, evidence, { expected: { failure: { category: "target_ambiguous", code: "web.target.ambiguous" } }, finalStateHolds: false }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && error.message.includes("target_not_found, expected target_ambiguous"),
  );
  assert.equal(evidence.length, 1, "the evidence is recorded before the expectation throws");
  const observation = evidence[0]!.observation;
  assert.equal(observation.lane, "flow");
  assert.equal(observation.flowCreated, true);
  assert.equal(observation.reportedVerdict, "failed");
  assert.deepEqual(observation.automationFailureReported, { category: "target_not_found", code: "web.target.not_found" });
  assert.deepEqual(observation.automationFailureExpected, { category: "target_ambiguous", code: "web.target.ambiguous" });
  assert.equal(observation.oracleVerdict, "failed", "the fixture oracle was consulted before the expectation threw");
});

test("a Flow that succeeds where a failure was expected is published as passed, with no reported failure", async () => {
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 });
  const evidence: FlowLaneEvidence[] = [];
  await assert.rejects(
    () => runLane(fake, evidence, { expected: { failure: { category: "target_ambiguous", code: "web.target.ambiguous" } } }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior",
  );
  const observation = evidence[0]?.observation;
  assert.equal(observation?.lane, "flow");
  assert.equal(observation?.flowCreated, true);
  assert.equal(observation?.reportedVerdict, "passed");
  assert.equal(observation?.automationFailureReported, null);
  assert.equal(observation?.oracleVerdict, "passed");
});

/** CS1f: `snapshots/flow-lane.json` is the only record of a resolution once Core's store is deleted. */
test("the flow-lane snapshot carries Core's target resolution on each action that has one", () => {
  const targetResolution = { status: "matched" as const, candidateCount: 1, minimumConfidence: 0.55, confidence: 0.9 };
  const evidence = {
    recording: { recordingId: "recording.one", entryCount: 2, entriesAppendedWhileWaiting: 0, waitedMs: 0, polls: 1 },
    proposal: { proposalId: "proposal.one", recordingId: "recording.one", mapperId: "web-recording-actions", status: "approved", candidateCount: 2, issues: [] },
    flowId: "flow.new",
    run: {
      runId: "run.one", status: "succeeded", failure: null, harnessActivations: 0, extracted: [], extractedNonStringValues: 2,
      actions: [
        { actionType: "web.dom.type", status: "succeeded", startedAt: new Date(0).toISOString(), failure: null, targetResolution },
        { actionType: "web.dom.click", status: "succeeded", startedAt: new Date(0).toISOString(), failure: null },
      ],
    },
    observation: {},
  } as unknown as FlowLaneEvidence;
  const snapshot = flowLaneSnapshot(evidence);
  assert.deepEqual(snapshot.actions, [
    { actionType: "web.dom.type", status: "succeeded", targetResolution },
    { actionType: "web.dom.click", status: "succeeded" },
  ]);
  assert.equal(snapshot.candidateCount, 2);
  assert.equal(snapshot.recording.entryCount, 2);
  // X0.7: the run's count of extracted values that are not strings is published beside the extraction count, as a count only.
  assert.equal(snapshot.extractionNonStringValues, 2);
});

/**
 * W18's shape: auth-gate records a username and a password, and the recorder
 * withholds the password, so the approved Flow's password node carries a
 * request under `web.secret.password` instead of a value. Core resolves that
 * path as a flat key of the run's inputs, so the declared value has to arrive
 * under exactly that key. `SUPPLIED` stands for the declared value and appears
 * nowhere in the Flow.
 */
const SUPPLIED = "value-declared-for-the-run";
const authGateScript: ScenarioStep[] = [
  { id: "enter-username", operation: "type", target: "testid:username" },
  { id: "enter-password", operation: "type", target: "testid:password" },
  { id: "submit-sign-in", operation: "click", target: "testid:sign-in" },
];
const authGateNodes = [
  { id: "node.username", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#username", text: "demo-user", element: { selector: "#username", testId: "username" } } } },
  { id: "node.password", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#password", text: { $state: { path: "web.secret.password" } }, element: { selector: "#password", inputType: "password", testId: "password", attributes: { "data-testid": "password", type: "password" } } } } },
];
const authGateSecret: DeclaredSecret = { id: "auth-gate-password", step: "enter-password", value: SUPPLIED };

/** `i-secret-in-workspace` fix 2: Core persists a run's inputs, so each value goes once, under its node's path; one for another workflow's step goes not at all. */
test("the run's inputs carry the declared value once, at the path the Flow's node asks for, and under no secret id", async () => {
  assert.equal(JSON.stringify(authGateNodes).includes(SUPPLIED), false, "the Flow holds a request, never the value");
  const otherWorkflowSecret: DeclaredSecret = { id: "auth-gate-passphrase", step: "enter-passphrase", value: "value-declared-for-another-workflow" };
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: authGateNodes });
  await runLane(fake, [], { scenarioId: "auth-gate", secrets: [authGateSecret, otherWorkflowSecret], recordingScript: authGateScript });
  const expected = { "web.secret.password": SUPPLIED, scenarioId: "auth-gate", facilityRunId: "run-test" };
  for (const inputs of [...fake.startedInputs, ...fake.runInputs]) assert.deepEqual([authGateSecret.id, otherWorkflowSecret.id].filter(id => Object.hasOwn(inputs, id)), [], "no input is keyed by a secret id");
  assert.deepEqual({ started: fake.startedInputs, run: fake.runInputs }, { started: [expected], run: [expected] }, "the run is started and executed with the value once, under the node's path");
});

test("a request no declaration answers fails the run before it starts, naming the path and never a value", async () => {
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: authGateNodes });
  // Declared, but for the username step, whose node asks for nothing: the
  // password request is unanswered and the declaration pairs with nothing.
  const misdeclared: DeclaredSecret = { id: "auth-gate-password", step: "enter-username", value: SUPPLIED };
  await assert.rejects(
    () => runLane(fake, [], { scenarioId: "auth-gate", secrets: [misdeclared], recordingScript: authGateScript }),
    (error: unknown) => error instanceof RunnerFailure
      && error.category === "fixture.invalid"
      && error.message.includes("web.secret.password")
      && error.message.includes("auth-gate-password")
      && !JSON.stringify({ message: error.message, details: error.details }).includes(SUPPLIED),
  );
  assert.deepEqual(fake.startedInputs, [], "nothing was started with an unanswered request");
  assert.deepEqual(fake.runInputs, []);
});

/**
 * What each node dispatches and what each node asks the run to supply come
 * from the same nodes, so one read of the approved Flow answers both. The lane
 * used to walk the parent Flow and every Subflow graph once per question.
 */
test("the approved Flow is read once for its action types and its requests for values supplied at run time", async () => {
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: authGateNodes });
  await runLane(fake, [], { scenarioId: "auth-gate", secrets: [authGateSecret], recordingScript: authGateScript });
  assert.deepEqual(fake.flowReads, ["get-flow:flow.new", "list-flow-subflows:flow.new", "get-flow:flow.graph"]);
  // That one read answered the password request, so the run started with its value.
  assert.equal(fake.startedInputs[0]?.["web.secret.password"], SUPPLIED);
});

/**
 * W17's shape: the file choice's node asks for its files under `web.upload.<key>`,
 * keyed by its recorded control, and the lane answers with the file the
 * recording lane chose. The file goes once, and nothing the lane records as
 * evidence carries it.
 */
test("the run's inputs carry the recording lane's file once, under the path the upload node asks for, and the lane's evidence never does", async () => {
  const uploadScript: ScenarioStep[] = [
    { id: "choose-upload-file", operation: "upload", target: "testid:upload-file", value: "expense-receipts.csv" },
    { id: "submit-upload", operation: "click", target: "testid:upload-submit" },
  ];
  const uploadNodes = [
    { id: "node.upload", parameterValues: { outputId: "web.dom.upload", parameters: { selector: "#upload-file", upload: { $state: { path: "web.upload.upload-file" } }, element: { selector: "#upload-file", testId: "upload-file", inputType: "file" } } } },
    { id: "node.submit", parameterValues: { outputId: "web.dom.click", parameters: { selector: "#upload-submit", element: { selector: "#upload-submit", testId: "upload-submit" } } } },
  ];
  const content = deterministicUploadBytes("expense-receipts.csv").toString("base64");
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: uploadNodes });
  const evidence: FlowLaneEvidence[] = [];
  await runLane(fake, evidence, { scenarioId: "file-transfer", recordingScript: uploadScript });
  const expected = { "web.upload.upload-file": { files: [{ name: "expense-receipts.csv", mimeType: "application/octet-stream", contentBase64: content }] }, scenarioId: "file-transfer", facilityRunId: "run-test" };
  assert.deepEqual({ started: fake.startedInputs, run: fake.runInputs }, { started: [expected], run: [expected] }, "the run is started and executed with the file once, under the node's path");
  assert.equal(JSON.stringify(flowLaneSnapshot(evidence[0]!)).includes(content), false, "the flow-lane snapshot holds no file content");
  assert.equal(JSON.stringify(evidence).includes(content), false, "nor does anything the lane hands the runner as evidence");
});

/** The evidence-size measure reaches `snapshots/flow-lane.json` through the lane, as sizes and flags only. */
test("each action's evidence packet sizes reach the flow-lane snapshot, and the packets themselves do not", async () => {
  const summary = { schemaVersion: "web-llm-evidence.v1", title: "Account for private.person", elements: [{ selector: "#account-summary" }], truncated: true };
  const stateRefs = { afterAction: { stateSnapshotId: "web.state.2", stateRef: "web.state.2@attempt.one:after_action", capturedAt: 15, summary } };
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, attempt: { metadata: { stateRefs } } });
  const evidence: FlowLaneEvidence[] = [];
  await runLane(fake, evidence);
  const snapshot = flowLaneSnapshot(evidence[0]!);
  assert.deepEqual(snapshot.actions, [
    { actionType: "web.dom.click", status: "succeeded", evidencePackets: [{ point: "afterAction", bytes: Buffer.byteLength(JSON.stringify(summary), "utf8"), truncated: true }] },
  ]);
  const serialised = JSON.stringify(snapshot);
  for (const content of ["private.person", "#account-summary", "web.state.2"]) assert.equal(serialised.includes(content), false, `${content} must not reach the snapshot`);
});

/**
 * Each Flow action reaches the page through Core, and the extension confirms it
 * on the recording channel after the recording was finalized, which Core audits
 * as a discard against that recording. The lane reports when it begins
 * dispatching, so the runner's second discard read stops counting there; a lane
 * that fails before dispatching reports nothing, and the runner's window stays
 * open.
 */
test("the lane reports the time just before it dispatches the Flow run, and a lane that never dispatches reports none", async () => {
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 });
  const reported: number[] = [];
  const before = Date.now();
  await runLane(fake, [], { flowDispatchStarting: at => { reported.push(at); fake.sequence.push("dispatch-reported"); } });
  const after = Date.now();
  assert.deepEqual(fake.sequence, ["reset", "prepare", "get-flow:flow.new", "list-flow-subflows:flow.new", "dispatch-reported", "start"], "reported once, after every read and before the Flow run is started");
  assert.equal(reported.length, 1);
  assert.ok(reported[0]! >= before && reported[0]! <= after, `reported ${String(reported[0])}, outside the lane's run from ${before} to ${after}`);

  const short = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, lostCandidates: 1 });
  const neverDispatched: number[] = [];
  await assert.rejects(() => runLane(short, [], { recordingEvents: basicFormEvents, flowDispatchStarting: at => { neverDispatched.push(at); } }));
  assert.deepEqual(neverDispatched, [], "a proposal refused before approval dispatches nothing, so nothing is reported");
});

/** Lab Stage 2, W18 and W09: a recording's `extract` step is the runner's own check, so Core proposed no extract node to yield records. */
test("a Flow with no extract node is not judged on the workflow's extraction, and its evidence says the expectation did not apply", async () => {
  const expected: ResolvedScenarioWorkflow["expected"] = { extracted: [{ step: "read-account", count: 1 }] };
  const evidence: FlowLaneEvidence[] = [];
  const { outcome } = await runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 }), evidence, { expected });
  assert.equal(outcome.extraction, "not_applicable");
  assert.equal(evidence[0]?.extraction, "not_applicable");
  assert.equal(flowLaneSnapshot(evidence[0]!).extractionExpectation, "not_applicable");

  const extracting = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: [{ id: "node.extract", parameterValues: { outputId: "web.dom.extract" } }] });
  const judged: FlowLaneEvidence[] = [];
  await assert.rejects(() => runLane(extracting, judged, { expected }), /produced 0 extraction result\(s\), expected 1/);
  assert.equal(judged[0]?.extraction, "judged", "published before the expectation is judged");
  assert.equal(flowLaneSnapshot(judged[0]!).extractionExpectation, "judged");

  const undeclared: FlowLaneEvidence[] = [];
  await runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 }), undeclared);
  assert.equal(undeclared[0]?.extraction, "not_expected");
});

/**
 * `i-w15-w28-flow-order`, W28 run 2: the Flow started at its last scroll, which
 * succeeded, and Core failed the run with the other actions unvisited. The lane
 * reported that as an expectation about a later action; it now fails as a stop,
 * after publishing the run.
 */
test("a Flow that stops with recorded actions never attempted and no failed attempt fails as exactly that, after its evidence is published", async () => {
  const graphNodes = [{ id: "node.two", parameterValues: { outputId: "web.dom.click" } }, { id: "node.three", parameterValues: { outputId: "web.dom.scroll" } }];
  const evidence: FlowLaneEvidence[] = [];
  await assert.rejects(
    () => runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes, runStatus: "failed" }), evidence, { expected: { actions: [{ action: "web.dom.scroll" }] } }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch" && error.message === "The Flow stopped with 2 recorded action(s) never attempted and no failed attempt, after 1 action(s) succeeded",
  );
  assert.equal(evidence.length, 1, "the run is published before the stop is judged");
  assert.deepEqual(flowLaneSnapshot(evidence[0]!).stoppedWithoutFailedAttempt, { attemptedActions: 1, unvisitedActions: 2 });
  const ranEveryAction: FlowLaneEvidence[] = [];
  await runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 }), ranEveryAction);
  assert.equal(flowLaneSnapshot(ranEveryAction[0]!).stoppedWithoutFailedAttempt, null);
});

/**
 * `i-w15-w28-flow-order`, W15: Core started the Flow at the recording's tab close,
 * a later candidate, and the close failed with no tab to act on. The lane judges
 * the start against the recording's candidate order, not Core's start rule, and
 * fails the run as a wrong start after publishing it.
 */
test("a Flow whose first attempt is not the recording's first action fails as a wrong start, by candidate position, after its evidence is published", async () => {
  const graphNodes = [{ id: "node.switch", parameterValues: { outputId: "web.browser.tab" } }, { id: "node.close", parameterValues: { outputId: "web.browser.tab" } }];
  const notFound = { category: "target_not_found", code: "web.target.not_found", retryable: true };
  const wrongStart = (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch" && error.message === "The Flow started at recorded action 3 of 4, not at the recording's first action";
  const evidence: FlowLaneEvidence[] = [];
  await assert.rejects(() => runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes, runStatus: "failed", attempt: { nodeId: "node.close", status: "failed", failure: notFound } }), evidence), wrongStart);
  assert.equal(evidence.length, 1, "the run is published before its start is judged");
  assert.equal(evidence[0]?.startCandidateIndex, 2);
  assert.equal(flowLaneSnapshot(evidence[0]!).startCandidateIndex, 2);
  // W28 run 2: started at a later action that succeeded, then stopped. The start is the cause, so it is what is named.
  await assert.rejects(() => runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes, runStatus: "failed", attempt: { nodeId: "node.close" } }), []), wrongStart);
  const started: FlowLaneEvidence[] = [];
  await runLane(fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes }), started);
  assert.equal(flowLaneSnapshot(started[0]!).startCandidateIndex, 0, "a run that started at the recording's first action says so");
});

test("an action node linked to no candidate of the recording's proposal fails the run before it starts", async () => {
  for (const metadata of [{}, { recordingCandidateId: "candidate.from-another-proposal" }]) {
    const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: [{ id: "node.unlinked", parameterValues: { outputId: "web.dom.click" }, metadata }] });
    const reported: number[] = [];
    await assert.rejects(
      () => runLane(fake, [], { flowDispatchStarting: at => { reported.push(at); } }),
      (error: unknown) => error instanceof RunnerFailure && error.category === "recording.contract" && (error.details as { unlinkedActionNodes?: unknown }).unlinkedActionNodes === 1,
      JSON.stringify(metadata),
    );
    assert.deepEqual(fake.startedInputs, [], "nothing was started");
    assert.deepEqual(reported, [], "and no dispatch was reported");
  }
});

/** Lab Stage 2, W19: Core's comparison status for the click reaches `snapshots/flow-lane.json`, so a run can quote `blocked`. */
test("each action's transition comparison status reaches the flow-lane snapshot", async () => {
  const authRequired = { category: "auth_required", code: "web.auth.required", retryable: false };
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, runStatus: "failed", attempt: { status: "failed", failure: authRequired, comparisonStatus: "blocked" } });
  const evidence: FlowLaneEvidence[] = [];
  await runLane(fake, evidence, { expected: { failure: { category: "auth_required" } } });
  assert.deepEqual(flowLaneSnapshot(evidence[0]!).actions, [{ actionType: "web.dom.click", status: "failed", failure: authRequired, comparisonStatus: "blocked" }]);
});
