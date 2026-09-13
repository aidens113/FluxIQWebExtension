import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { runFlowLane, type FlowLaneControl, type FlowLaneEvidence } from "../run-flow-lane.js";

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
 */
function fakeCore(options: { appendsAt: readonly number[]; finalizedAt?: number }) {
  const clock = { value: 0 };
  const proposalRequestedAt: number[] = [];
  const visibleEntries = () => options.appendsAt.filter(at => at <= clock.value).length;
  const proposal = (candidateCount: number) => ({
    proposalId: "proposal.one",
    recordingId: "recording.one",
    status: "proposed",
    generatedAt: clock.value,
    mapper: { id: "web-recording-actions", version: "0.1" },
    candidates: Array.from({ length: candidateCount }, (_value, index) => ({ candidateId: `candidate.${index}`, outputId: "web.dom.type" })),
  });
  const control: FlowLaneControl = {
    automationStudioCall: async (endpoint: string) => {
      if (endpoint === "list-recordings") {
        const ended = options.finalizedAt !== undefined && clock.value >= options.finalizedAt;
        return { recordings: [{ recordingId: "recording.one", startedAt: 0, ...(ended ? { endedAt: options.finalizedAt } : {}), metadata: { summaryOnly: true, eventCount: visibleEntries() } }] };
      }
      if (endpoint === "create-recording-flow-proposals") {
        proposalRequestedAt.push(clock.value);
        // Core's own behaviour: it maps the timeline as it stands, and says so
        // in `issues` without failing.
        return { proposals: [proposal(visibleEntries())], issues: ["mapped the recording as it stood"] };
      }
      if (endpoint === "review-recording-flow-proposal") {
        return { proposal: { ...proposal(visibleEntries()), status: "approved", review: { decision: "approved", destination: { kind: "flow", flowId: "flow.new", created: true } } }, flow: { flowId: "flow.new" } };
      }
      if (endpoint === "get-flow") return { flow: { nodes: [{ id: "node.one", parameterValues: { outputId: "web.dom.click" } }] } };
      if (endpoint === "list-flow-subflows") return { subflows: [] };
      if (endpoint === "get-flow-run-detail") {
        return { runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts: [{ attemptId: "attempt.one", nodeId: "node.one", definitionId: "builtin.policy.action", order: 1, status: "succeeded", startedAt: 10, finishedAt: 20 }], interventions: [] } };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
    selectExistingContext: async () => {},
    startPersistedFlow: async () => ({ runId: "run.one" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", status: "succeeded" } }),
  };
  return {
    control,
    proposalRequestedAt,
    now: () => clock.value,
    sleep: async (ms: number) => { clock.value += ms; },
  };
}

async function runLane(fake: ReturnType<typeof fakeCore>, evidence: FlowLaneEvidence[]) {
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
      scenario: { id: "basic-form", recordingScript: [], expected: {} } as unknown as WebScenario,
      workflow: { expected: {} } as unknown as ResolvedScenarioWorkflow,
      facilityRunId: "run-test",
      scenarioOrigin: "http://127.0.0.1:4310",
      runToken: "token",
      secrets: [],
      armVariant: async () => {},
      recordEvidence: async (item) => { evidence.push(item); },
      checkFinalState: async () => true,
    });
    return { outcome, resetCalls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("the lane proposes from the finished recording, not from the entries Core happens to have appended", async () => {
  // One entry is already visible when the lane starts; the other three land
  // over the next 900 ms and Core finalizes at 1_500 ms.
  const fake = fakeCore({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 });
  const evidence: FlowLaneEvidence[] = [];
  const { outcome, resetCalls } = await runLane(fake, evidence);
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
