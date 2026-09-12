import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { approveRecordingFlowProposal, createRecordingFlowProposal } from "../recording-flow-proposal.js";

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
