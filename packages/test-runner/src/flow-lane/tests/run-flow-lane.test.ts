import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedEvent, ResolvedScenarioWorkflow, ScenarioStep, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
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
 * attempt the run detail reports.
 */
function fakeCore(options: { appendsAt: readonly number[]; finalizedAt?: number; graphNodes?: readonly unknown[]; lostCandidates?: number; attempt?: Record<string, unknown>; runStatus?: string }) {
  const clock = { value: 0 };
  const proposalRequestedAt: number[] = [];
  const reviewedProposals: string[] = [];
  const startedInputs: Record<string, unknown>[] = [];
  const runInputs: Record<string, unknown>[] = [];
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
        if (payload.flowId === "flow.graph") return { flow: { nodes: options.graphNodes ?? [] } };
        return { flow: { nodes: [{ id: "node.one", parameterValues: { outputId: "web.dom.click" } }] } };
      }
      if (endpoint === "list-flow-subflows") return { subflows: options.graphNodes ? [{ graphFlowId: "flow.graph" }] : [] };
      if (endpoint === "get-flow-run-detail") {
        const attempt = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "builtin.policy.action", order: 1, status: "succeeded", startedAt: 10, finishedAt: 20, ...options.attempt };
        return { runDetail: { summary: { runId: "run.one", status: options.runStatus ?? "succeeded" }, actionAttempts: [attempt], interventions: [] } };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
    selectExistingContext: async () => {},
    startPersistedFlow: async (input) => { startedInputs.push(input.inputs ?? {}); return { runId: "run.one" }; },
    runPersistedFlow: async (input) => { runInputs.push(input.inputs ?? {}); return { session: { runId: "run.one", status: options.runStatus ?? "succeeded" } }; },
  };
  return {
    control,
    proposalRequestedAt,
    reviewedProposals,
    startedInputs,
    runInputs,
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
};

async function runLane(fake: ReturnType<typeof fakeCore>, evidence: FlowLaneEvidence[], lane: LaneOptions = {}) {
  const resetCalls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => { resetCalls.push(String(url)); return { ok: true, status: 200 }; }) as unknown as typeof globalThis.fetch;
  try {
    const outcome = await runFlowLane({
      control: fake.control,
      projectId: "project.web",
      authorizationPin: "123456",
      recordingId: "recording.one",
      recordingWait: { now: fake.now, sleep: fake.sleep, intervalMs: 100, timeoutMs: 10_000 },
      scenario: { id: lane.scenarioId ?? "basic-form", recordingScript: [], expected: {} } as unknown as WebScenario,
      workflow: { expected: lane.expected ?? {}, recordingScript: lane.recordingScript ?? [] } as unknown as ResolvedScenarioWorkflow,
      recordingEvents: lane.recordingEvents ?? [],
      facilityRunId: "run-test",
      scenarioOrigin: "http://127.0.0.1:4310",
      runToken: "token",
      secrets: lane.secrets ?? [],
      armVariant: async () => {},
      recordEvidence: async (item) => { evidence.push(item); },
      checkFinalState: async () => lane.finalStateHolds ?? true,
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
      runId: "run.one", status: "succeeded", failure: null, harnessActivations: 0, extracted: [],
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

test("the run's inputs carry the declared value at the path the Flow's node asks for", async () => {
  assert.equal(JSON.stringify(authGateNodes).includes(SUPPLIED), false, "the Flow holds a request, never the value");
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500, graphNodes: authGateNodes });
  await runLane(fake, [], { scenarioId: "auth-gate", secrets: [authGateSecret], recordingScript: authGateScript });
  const expected = { "auth-gate-password": SUPPLIED, "web.secret.password": SUPPLIED, scenarioId: "auth-gate", facilityRunId: "run-test" };
  assert.deepEqual(fake.startedInputs, [expected], "the run is started with the value under the node's path");
  assert.deepEqual(fake.runInputs, [expected], "and executed with it");
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
