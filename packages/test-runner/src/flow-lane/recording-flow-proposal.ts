import type { ExpectedEvent } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";

/** The Core calls the Flow lane makes; `ExistingFluxIQControlClient` satisfies it. */
export type RecordingProposalControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/**
 * `issues` is Core's own account of what it could not map. It used to be read
 * and then dropped on the success path, surfacing only when the proposal was
 * empty -- so a proposal that was merely *short* arrived with no explanation
 * at all, which is a large part of why `L-dropped-action` survived undiagnosed
 * from Wave 2. It is carried out of here on every path now, and written into
 * the run bundle whether the lane passes or fails.
 */
export type RecordingFlowProposal = { proposalId: string; recordingId: string; mapperId: string; status: string; candidateCount: number; issues: readonly string[] };
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
    issues,
  };
}

/**
 * The recorded event types Core's web mapper turns into one action candidate
 * each (`webAutomationRecordedAction`, domain `io/input-model.ts`, called once
 * per timeline entry by `mapWebRecordingObservation`). Core compacts only state
 * checkpoints and state observations before mapping, never these.
 *
 * Left out, because on some pages they map to no action: a navigation (only a
 * typed one is an action), a scroll (only with coordinates), and every
 * evidence type. Kept despite one exception each, which no manifest pins a
 * count on: a checkbox or radio toggle stays evidence until the recorder
 * reports its checked state, and a key that only changes a `<select>`'s value
 * is evidence.
 */
const EXECUTABLE_RECORDING_EVENT_TYPES: ReadonlySet<string> = new Set(["web.element.clicked", "web.element.input_changed", "web.element.changed", "web.keyboard.pressed"]);

/**
 * A proposal short of the recording is a contract failure, not a smaller pass.
 *
 * The count comes from the recording workflow's `expected.recordingEvents`,
 * and only from entries that pin an exact `count` on an executable type. That
 * is the one declaration already proven true of this very recording: the
 * recording lane asserts those exact counts against the extension's own log
 * before the Flow lane starts. So a proposal with fewer candidates lost an
 * action after the extension recorded it. `expected.actions` cannot say this:
 * each entry is matched by *some* attempt of its type, so two recorded
 * `web.dom.type` actions and one are the same declaration. The recording script
 * cannot either: it says what the lane did to the page, not what the recorder
 * captured. An entry without a count only says "at least one" and pins nothing.
 */
export function assertProposalCoversRecording(proposal: RecordingFlowProposal, recordingEvents: readonly ExpectedEvent[]): void {
  const pinned = recordingEvents.filter((event) => event.count !== undefined && EXECUTABLE_RECORDING_EVENT_TYPES.has(event.type));
  const expectedExecutableActions = pinned.reduce((total, event) => total + (event.count ?? 0), 0);
  if (proposal.candidateCount >= expectedExecutableActions) return;
  throw new RunnerFailure(
    "recording.contract",
    `Core's recording Flow proposal carried ${proposal.candidateCount} action candidate(s), but the recording pins ${expectedExecutableActions} executable action(s), so an approved Flow would silently skip a recorded step`,
    { details: { candidateCount: proposal.candidateCount, expectedExecutableActions, pinnedEvents: pinned.map((event) => ({ type: event.type, count: event.count ?? 0 })), issues: [...proposal.issues] } },
  );
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
