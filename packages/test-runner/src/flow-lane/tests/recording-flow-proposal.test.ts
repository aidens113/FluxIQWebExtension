import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedEvent } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { approveRecordingFlowProposal, assertProposalCoversRecording, createRecordingFlowProposal, type RecordingFlowProposal } from "../recording-flow-proposal.js";

const candidate = { candidateId: "candidate.one", outputId: "web.dom.type" };
const proposal = (overrides: Record<string, unknown> = {}) => ({
  proposalId: "proposal.one", recordingId: "recording.one", status: "proposed", generatedAt: 10,
  mapper: { id: "web-recording-actions", version: "0.1" }, candidates: [candidate], ...overrides,
});

function control(responses: Record<string, unknown>) {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  return {
    calls,
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown> = {}) => {
      calls.push({ endpoint, payload });
      if (!(endpoint in responses)) throw new Error(`unexpected endpoint ${endpoint}`);
      return responses[endpoint];
    },
  };
}

test("a recording becomes a proposal through Core's public endpoint, newest first", async () => {
  const client = control({ "create-recording-flow-proposals": { proposals: [proposal(), proposal({ proposalId: "proposal.two", generatedAt: 20 })], issues: [] } });
  const result = await createRecordingFlowProposal(client, { projectId: "project.web", recordingId: "recording.one" });
  assert.equal(result.proposalId, "proposal.two");
  assert.equal(result.mapperId, "web-recording-actions");
  assert.equal(result.candidateCount, 1);
  assert.deepEqual(client.calls[0], { endpoint: "create-recording-flow-proposals", payload: { projectId: "project.web", recordingId: "recording.one", force: true } });
});

test("a proposal for another recording, or none at all, is a recording-contract failure carrying Core's issues", async () => {
  const client = control({ "create-recording-flow-proposals": { proposals: [proposal({ recordingId: "recording.other" })], issues: ["No mapper-visible entries remained"] } });
  await assert.rejects(
    () => createRecordingFlowProposal(client, { projectId: "project.web", recordingId: "recording.one" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "recording.contract" && Array.isArray((error.details as { issues?: string[] }).issues),
  );
});

test("a proposal with no candidate is refused, since an approved Flow would execute nothing", async () => {
  const client = control({ "create-recording-flow-proposals": { proposals: [proposal({ candidates: [] })], issues: [] } });
  await assert.rejects(() => createRecordingFlowProposal(client, { projectId: "project.web", recordingId: "recording.one" }), /carried no action candidate/);
});

test("approval returns the Flow Core created, and the destination must name it", async () => {
  const approved = { proposal: { ...proposal({ status: "approved" }), review: { decision: "approved", destination: { kind: "flow", flowId: "flow.new", created: true } } }, flow: { flowId: "flow.new" } };
  const client = control({ "review-recording-flow-proposal": approved });
  const result = await approveRecordingFlowProposal(client, { projectId: "project.web", proposalId: "proposal.one", authorizationPin: "123456", name: "Lab flow" });
  assert.deepEqual(result, { flowId: "flow.new", proposalId: "proposal.one", created: true });
  assert.deepEqual(client.calls[0]?.payload, { projectId: "project.web", proposalId: "proposal.one", decision: "approved", destination: { kind: "flow", name: "Lab flow" }, authorizationPin: "123456" });
});

test("an unapproved proposal or a mismatched destination is refused", async () => {
  const rejected = control({ "review-recording-flow-proposal": { proposal: { ...proposal({ status: "rejected" }), review: {} }, flow: { flowId: "flow.new" } } });
  await assert.rejects(() => approveRecordingFlowProposal(rejected, { projectId: "p", proposalId: "proposal.one", authorizationPin: "1", name: "n" }), /did not approve/);
  const mismatched = control({ "review-recording-flow-proposal": { proposal: { ...proposal({ status: "approved" }), review: { destination: { kind: "flow", flowId: "flow.other", created: true } } }, flow: { flowId: "flow.new" } } });
  await assert.rejects(() => approveRecordingFlowProposal(mismatched, { projectId: "p", proposalId: "proposal.one", authorizationPin: "1", name: "n" }), /did not name the Flow/);
});

/**
 * B1: a proposal short of the recording is compared to something. The two
 * declarations below are copied from the real manifests (`basic-form`'s
 * `scenario.ts`, `auth-gate`'s `manifest.ts`) as they stand.
 */
const withCandidates = (candidateCount: number): RecordingFlowProposal => ({ proposalId: "proposal.one", recordingId: "recording.one", mapperId: "web-recording-actions", status: "proposed", candidateCount, issues: ["mapped the recording as it stood"] });
const basicForm: ExpectedEvent[] = [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.changed", count: 1 }, { type: "web.element.clicked", count: 1 }];
const authGate: ExpectedEvent[] = [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }];

function refusal(proposal: RecordingFlowProposal, events: readonly ExpectedEvent[]): RunnerFailure {
  try { assertProposalCoversRecording(proposal, events); }
  catch (error) { if (error instanceof RunnerFailure) return error; throw error; }
  assert.fail(`a proposal of ${proposal.candidateCount} candidate(s) was accepted against ${JSON.stringify(events)}`);
}

test("a proposal covering every executable action the recording pins is accepted, and a longer one is no loss", () => {
  assert.doesNotThrow(() => assertProposalCoversRecording(withCandidates(4), basicForm));
  assert.doesNotThrow(() => assertProposalCoversRecording(withCandidates(5), basicForm));
  assert.doesNotThrow(() => assertProposalCoversRecording(withCandidates(3), authGate));
});

test("a lost second web.dom.type fails as a recording contract, naming the counts and Core's issues", () => {
  // auth-gate recorded two text entries and a click; Core proposed two actions.
  const error = refusal(withCandidates(2), authGate);
  assert.equal(error.category, "recording.contract");
  assert.deepEqual(error.details, {
    candidateCount: 2,
    expectedExecutableActions: 3,
    pinnedEvents: [{ type: "web.element.input_changed", count: 2 }, { type: "web.element.clicked", count: 1 }],
    issues: ["mapped the recording as it stood"],
  });
  assert.equal(refusal(withCandidates(3), basicForm).category, "recording.contract");
  // keyboard-forms' combobox pins three key presses.
  assert.equal(refusal(withCandidates(2), [{ type: "web.keyboard.pressed", count: 3 }]).category, "recording.contract");
});

test("a declaration without a count, or on a type that is not always an action, pins nothing", () => {
  const unpinned: ExpectedEvent[] = [
    { type: "web.element.clicked" },
    { type: "web.element.input_changed" },
    { type: "web.form.submitted", count: 1 },
    { type: "web.scroll.changed", count: 5 },
    { type: "web.page.navigated", count: 1 },
    { type: "web.snapshot.captured", count: 9 },
  ];
  assert.doesNotThrow(() => assertProposalCoversRecording(withCandidates(1), unpinned));
  assert.doesNotThrow(() => assertProposalCoversRecording(withCandidates(1), []));
});
