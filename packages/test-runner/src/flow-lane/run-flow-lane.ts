import type { ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { FluxIQHttpOptions } from "../http-control.js";
import { declaredSecretFlowInputs, type DeclaredSecret } from "./declared-secrets.js";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure } from "./expectations.js";
import { readFlowActionTypes } from "./flow-action-types.js";
import { flowLaneObservation, type RunLaneObservation } from "./lane-observation.js";
import { approveRecordingFlowProposal, createRecordingFlowProposal, type RecordingFlowProposal } from "./recording-flow-proposal.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "./persisted-flow-run.js";
import { resetScenarioLab } from "./reset-scenario-lab.js";
import type { RecordingProposalControl } from "./recording-flow-proposal.js";

export type FlowLaneControl = PersistedFlowRunControl & RecordingProposalControl;

export type FlowLaneInput = {
  control: FlowLaneControl;
  projectId: string;
  authorizationPin: string;
  /** The recording the run just produced; the Flow is generated from exactly this one. */
  recordingId: string;
  scenario: WebScenario;
  workflow: ResolvedScenarioWorkflow;
  facilityRunId: string;
  scenarioOrigin: string;
  runToken: string;
  /** Resolved by the runner, which also adds their values to the evidence redaction list. */
  secrets: readonly DeclaredSecret[];
  /** Arms the resolved variant. Injected so the runner keeps ownership of Lab control. */
  armVariant: () => Promise<void>;
  /**
   * Records what the Flow did, before any expectation is judged. Evidence that
   * is only written once the assertions pass cannot explain the run that
   * failed them, which is precisely when it is needed.
   */
  recordEvidence: (evidence: FlowLaneEvidence) => Promise<void>;
  /** The fixture oracle, run after the Flow. Returns whether the final state held. */
  checkFinalState: () => Promise<boolean>;
  bounds?: FluxIQHttpOptions;
};

/** What the lane observed, handed to the runner before the expectations are judged. */
export type FlowLaneEvidence = { proposal: RecordingFlowProposal; flowId: string; run: PersistedFlowRunOutcome };

export type FlowLaneOutcome = {
  proposal: RecordingFlowProposal;
  flowId: string;
  run: PersistedFlowRunOutcome;
  observation: RunLaneObservation;
};

/**
 * The provider-free Flow lane: reset, generate a Flow from the recording
 * through Core's public proposal API, arm the variant, run the Flow, and
 * judge it. No provider is configured and none is needed — every step is a
 * Core call or a fixture assertion.
 *
 * The reset comes before the arm because a reset would discard the arm, and
 * before the run because otherwise the Flow would be judged against the
 * recording lane's own leftovers.
 */
export async function runFlowLane(input: FlowLaneInput): Promise<FlowLaneOutcome> {
  const bounds = input.bounds ?? {};
  const proposal = await createRecordingFlowProposal(input.control, { projectId: input.projectId, recordingId: input.recordingId }, bounds);
  const approved = await approveRecordingFlowProposal(input.control, {
    projectId: input.projectId,
    proposalId: proposal.proposalId,
    authorizationPin: input.authorizationPin,
    name: `Lab flow ${input.facilityRunId}`,
  }, bounds);
  await resetScenarioLab(input.scenarioOrigin, input.runToken);
  if (input.workflow.variant) await input.armVariant();
  // Read before running: the map identifies each attempt, and a Flow whose
  // nodes dispatch no output could not have run the recording at all.
  const actionTypes = await readFlowActionTypes(input.control, { projectId: input.projectId, flowId: approved.flowId }, bounds);
  const run = await executeRecordedFlowRun(input.control, {
    projectId: input.projectId,
    flowId: approved.flowId,
    facilityRunId: input.facilityRunId,
    actionTypes,
    inputs: { ...declaredSecretFlowInputs(input.secrets), scenarioId: input.scenario.id, facilityRunId: input.facilityRunId },
  }, bounds);
  await input.recordEvidence({ proposal, flowId: approved.flowId, run });
  const expected = input.workflow.expected;
  assertFlowFailure(expected.failure, run.failure);
  assertFlowActions(expected.actions, run.actions);
  assertFlowExtraction(expected.extracted, run.extracted);
  const oracleHeld = await input.checkFinalState();
  return {
    proposal,
    flowId: approved.flowId,
    run,
    observation: flowLaneObservation({
      flowCreated: true,
      oracleVerdict: oracleHeld ? "passed" : "failed",
      run,
      automationFailureExpected: expected.failure ?? null,
    }),
  };
}
