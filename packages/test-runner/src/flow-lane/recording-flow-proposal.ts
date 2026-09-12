import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";

/** The Core calls the Flow lane makes; `ExistingFluxIQControlClient` satisfies it. */
export type RecordingProposalControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

export type RecordingFlowProposal = { proposalId: string; recordingId: string; mapperId: string; status: string; candidateCount: number };
export type ApprovedRecordingFlow = { flowId: string; proposalId: string; created: boolean };

/**
 * Turns a persisted recording into Flow proposals through Core's public
 * `create-recording-flow-proposals`. Nothing is built downstream: Core's own
 * recording mappers produce every candidate, and this only reads the result.
 * A recording that yields no candidate is a contract failure, not an empty
 * pass — an approved Flow with no action would run green having done nothing.
 */
export async function createRecordingFlowProposal(
  control: RecordingProposalControl,
  input: { projectId: string; recordingId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<RecordingFlowProposal> {
  const payload = asRecord(await control.automationStudioCall("create-recording-flow-proposals", { projectId: input.projectId, recordingId: input.recordingId, force: true }, bounds), "create-recording-flow-proposals payload");
  const issues = Array.isArray(payload.issues) ? payload.issues.filter((issue): issue is string => typeof issue === "string") : [];
  const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
  const forRecording = proposals.map((value, index) => asRecord(value, `proposals[${index}]`)).filter((proposal) => proposal.recordingId === input.recordingId);
  if (!forRecording.length) {
    throw new RunnerFailure("recording.contract", "Core produced no recording Flow proposal for the run's recording", { details: { issues, proposalCount: proposals.length } });
  }
  const newest = forRecording.reduce((left, right) => (numberOf(right.generatedAt) >= numberOf(left.generatedAt) ? right : left));
  const candidates = Array.isArray(newest.candidates) ? newest.candidates : [];
  if (!candidates.length) {
    throw new RunnerFailure("recording.contract", "Core's recording Flow proposal carried no action candidate, so an approved Flow would execute nothing", { details: { issues } });
  }
  return {
    proposalId: textOf(newest.proposalId, "proposal.proposalId"),
    recordingId: input.recordingId,
    mapperId: textOf(asRecord(newest.mapper, "proposal.mapper").id, "proposal.mapper.id"),
    status: textOf(newest.status, "proposal.status"),
    candidateCount: candidates.length,
  };
}

/**
 * Approves a proposal into a new Flow through Core's public
 * `review-recording-flow-proposal`. Core creates and writes the Flow; the
 * lane never authors or compiles a Flow document of its own.
 */
export async function approveRecordingFlowProposal(
  control: RecordingProposalControl,
  input: { projectId: string; proposalId: string; authorizationPin: string; name: string },
  bounds: FluxIQHttpOptions = {},
): Promise<ApprovedRecordingFlow> {
  const payload = asRecord(await control.automationStudioCall("review-recording-flow-proposal", {
    projectId: input.projectId,
    proposalId: input.proposalId,
    decision: "approved",
    destination: { kind: "flow", name: input.name },
    authorizationPin: input.authorizationPin,
  }, bounds), "review-recording-flow-proposal payload");
  const proposal = asRecord(payload.proposal, "review.proposal");
  if (proposal.status !== "approved") throw new RunnerFailure("recording.contract", `Core did not approve the recording Flow proposal (status ${String(proposal.status)})`);
  const flow = asRecord(payload.flow, "review.flow");
  const review = asRecord(proposal.review, "review.proposal.review");
  const destination = asRecord(review.destination, "review.proposal.review.destination");
  const flowId = textOf(flow.flowId, "review.flow.flowId");
  if (destination.kind !== "flow" || destination.flowId !== flowId) throw new RunnerFailure("recording.contract", "Core's approval destination did not name the Flow it returned");
  return { flowId, proposalId: input.proposalId, created: destination.created === true };
}

function asRecord(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RunnerFailure("recording.contract", `${at} must be an object`);
  return value as Record<string, unknown>;
}
function textOf(value: unknown, at: string): string {
  if (typeof value !== "string" || !value) throw new RunnerFailure("recording.contract", `${at} must be a non-empty string`);
  return value;
}
function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
