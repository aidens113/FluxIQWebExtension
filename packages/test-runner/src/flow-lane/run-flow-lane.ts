import type { ExpectedEvent, ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { FluxIQHttpOptions } from "../http-control.js";
import { declaredSecretBindingInputs, flowSecretRequests, type DeclaredSecret } from "./declared-secrets.js";
import { declaredUploadInputs, flowUploadRequests } from "./declared-uploads.js";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure, flowExtractionExpectation, type FlowExtractionExpectation } from "./expectations.js";
import { awaitFinalizedRecording, type FinalizedRecording, type FinalizedRecordingWait } from "./finalized-recording.js";
import { flowActionTypes, readFlowNodes } from "./flow-action-types.js";
import { flowLaneObservation, type RunLaneObservation } from "./lane-observation.js";
import { approveRecordingFlowProposal, assertProposalCoversRecording, createRecordingFlowProposal, type RecordingFlowProposal } from "./recording-flow-proposal.js";
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
  /** Bounds and clock for the wait on that recording's completion. Production passes none. */
  recordingWait?: FinalizedRecordingWait;
  scenario: WebScenario;
  workflow: ResolvedScenarioWorkflow;
  /**
   * The `expected.recordingEvents` of the workflow that was recorded -- the
   * unarmed one -- which the recording lane has already asserted against the
   * extension's log. The proposal must cover the executable actions they pin
   * (`assertProposalCoversRecording`).
   */
  recordingEvents: readonly ExpectedEvent[];
  facilityRunId: string;
  scenarioOrigin: string;
  runToken: string;
  /** Resolved by the runner, which also adds their values to the evidence redaction list. */
  secrets: readonly DeclaredSecret[];
  /**
   * Presents the page the Flow runs against: arms the resolved variant, if
   * any, and loads the scenario's start page. Called on every run, armed or
   * not. Injected so the runner keeps ownership of Lab control and the page.
   */
  prepareFlowPage: () => Promise<void>;
  /**
   * Records what the Flow did, before any expectation is judged. Evidence that
   * is only written once the assertions pass cannot explain the run that
   * failed them, which is precisely when it is needed.
   */
  recordEvidence: (evidence: FlowLaneEvidence) => Promise<void>;
  /** The fixture oracle, run after the Flow and before its expectations are judged. Returns whether the final state held. */
  checkFinalState: () => Promise<boolean>;
  /**
   * Told the time, in epoch milliseconds, just before the lane dispatches the
   * Flow run, and never when the lane fails before that. Each Flow action
   * reaches the page through Core, and the extension confirms it on the
   * recording channel after the recording was finalized, so Core audits it as a
   * discard against that recording: the runner's discard read stops here.
   */
  flowDispatchStarting: (at: number) => void;
  bounds?: FluxIQHttpOptions;
};

/**
 * What the lane observed, handed to the runner before the expectations are
 * judged. `observation` is the run's `RunLaneObservation` as it stands then,
 * so a run whose expectations fail is still published as the Flow run it was.
 * `extraction` says whether the workflow's extraction expectation applied to
 * this Flow, and so whether it is judged.
 */
export type FlowLaneEvidence = { recording: FinalizedRecording; proposal: RecordingFlowProposal; flowId: string; run: PersistedFlowRunOutcome; observation: RunLaneObservation; extraction: FlowExtractionExpectation };

export type FlowLaneOutcome = {
  recording: FinalizedRecording;
  proposal: RecordingFlowProposal;
  flowId: string;
  run: PersistedFlowRunOutcome;
  observation: RunLaneObservation;
  extraction: FlowExtractionExpectation;
};

/**
 * The provider-free Flow lane: wait for Core to finish writing the recording,
 * generate a Flow from that recording through Core's public proposal API,
 * reset, prepare the page, run the Flow, and judge it. No provider is configured and none is needed — every step is a
 * Core call or a fixture assertion.
 *
 * The reset comes before the page is prepared because a reset would discard
 * an arm, and both come before the run because otherwise the Flow would be
 * judged against the recording lane's own leftovers.
 */
export async function runFlowLane(input: FlowLaneInput): Promise<FlowLaneOutcome> {
  const bounds = input.bounds ?? {};
  // Before anything reads the recording. Core finishes writing it after the
  // client has stopped, and a proposal requested during that window carries
  // only the actions Core happened to have appended -- the defect
  // `L-dropped-action` reproduced 12 times in 24 runs.
  const recording = await awaitFinalizedRecording(input.control, { projectId: input.projectId, recordingId: input.recordingId }, bounds, input.recordingWait ?? {});
  const proposal = await createRecordingFlowProposal(input.control, { projectId: input.projectId, recordingId: input.recordingId }, bounds);
  // Before approval: a proposal short of what the recording pins would become
  // a Flow that skips a recorded step and can still exit green.
  assertProposalCoversRecording(proposal, input.recordingEvents);
  const approved = await approveRecordingFlowProposal(input.control, {
    projectId: input.projectId,
    proposalId: proposal.proposalId,
    authorizationPin: input.authorizationPin,
    name: `Lab flow ${input.facilityRunId}`,
  }, bounds);
  await resetScenarioLab(input.scenarioOrigin, input.runToken);
  // Every run, not only an armed one: the reset reloads nothing, so an unarmed
  // Flow started wherever the recording left the tab (W18, on auth-gate's
  // account page, where no password field exists).
  await input.prepareFlowPage();
  // Read before running, and once: the same nodes answer both questions below.
  const nodes = await readFlowNodes(input.control, { projectId: input.projectId, flowId: approved.flowId }, bounds);
  // The map identifies each attempt, and a Flow whose nodes dispatch no output
  // could not have run the recording at all.
  const actionTypes = flowActionTypes(nodes, approved.flowId);
  // A node on a sensitive control asks for its value under a path rather than
  // carrying it. Each such request is answered by exactly one declared secret,
  // keyed by the path Core resolves, or the run fails here, before it starts.
  const secretInputs = declaredSecretBindingInputs({
    scenarioId: input.scenario.id,
    secrets: input.secrets,
    steps: input.workflow.recordingScript,
    requests: flowSecretRequests(nodes),
  });
  // A node on a file input asks for its files the same way, keyed by its recorded
  // control. It gets the file the recording lane chose, or the run fails here.
  const uploadInputs = declaredUploadInputs({ scenarioId: input.scenario.id, steps: input.workflow.recordingScript, requests: flowUploadRequests(nodes) });
  // Just before the first Flow action can reach Core, whose runtime confirmation Core audits against the finalized recording.
  input.flowDispatchStarting(Date.now());
  const run = await executeRecordedFlowRun(input.control, {
    projectId: input.projectId,
    flowId: approved.flowId,
    facilityRunId: input.facilityRunId,
    actionTypes,
    // Each declared value and each supplied file once, under the path a node reads: Core persists a run's inputs, so any further copy is a copy on disk.
    inputs: { ...secretInputs, ...uploadInputs, scenarioId: input.scenario.id, facilityRunId: input.facilityRunId },
  }, bounds);
  const expected = input.workflow.expected;
  // A Flow with no extract node cannot yield the records a recording's `extract` step checked, so that expectation is not judged here.
  const extraction = flowExtractionExpectation(expected.extracted, actionTypes);
  // The oracle and the publish both come before the asserts. An assert throws
  // on any mismatch, and a run that failed one used to leave the runner with no
  // Flow observation at all, so the category Core reported never reached the
  // evaluation. Consulting the oracle first costs a failing run the oracle's
  // wait and buys it a real `oracleVerdict` instead of a null.
  const oracleHeld = await input.checkFinalState();
  const observation = flowLaneObservation({
    flowCreated: true,
    oracleVerdict: oracleHeld ? "passed" : "failed",
    run,
    automationFailureExpected: expected.failure ?? null,
  });
  await input.recordEvidence({ recording, proposal, flowId: approved.flowId, run, observation, extraction });
  assertFlowFailure(expected.failure, run.failure);
  assertFlowActions(expected.actions, run.actions);
  assertFlowExtraction(expected.extracted, run.extracted, actionTypes);
  return { recording, proposal, flowId: approved.flowId, run, observation, extraction };
}

/**
 * The `snapshots/flow-lane.json` document for what the lane observed: Core's
 * identifiers, statuses, counts and structured records, never page content.
 *
 * The recording's own entry count sits beside the candidate count on purpose:
 * a Flow short of an action shows here as fewer candidates than entries, which
 * is what nobody could see before. `secondWait` is the lane's own wait on the
 * recording, which follows the runner's (`runtime.settle`): it counts entries
 * from its own first poll, not from Stop, so it reads 0 once the runner's wait
 * has seen the recording finished. Each action carries Core's target
 * resolution, when Core resolved one, because Core's store is deleted when the
 * run ends and this file is then the only record of how a target was found.
 * For the same reason each action carries the size and truncation flag of the
 * sanitized evidence packets Core captured around it -- measurements, never the
 * packets. `extractionExpectation` says whether the workflow's extraction was
 * judged against this Flow, and each action carries Core's transition
 * comparison status when Core reported one.
 */
export function flowLaneSnapshot(evidence: FlowLaneEvidence) {
  return {
    recording: { recordingId: evidence.recording.recordingId, entryCount: evidence.recording.entryCount, secondWait: { entriesAppendedAfterFirstPoll: evidence.recording.entriesAppendedWhileWaiting, waitMs: evidence.recording.waitedMs, polls: evidence.recording.polls } },
    proposalId: evidence.proposal.proposalId, mapperId: evidence.proposal.mapperId, candidateCount: evidence.proposal.candidateCount, proposalIssues: [...evidence.proposal.issues],
    flowId: evidence.flowId, runtimeRunId: evidence.run.runId, status: evidence.run.status,
    harnessActivations: evidence.run.harnessActivations, failure: evidence.run.failure, extractionCount: evidence.run.extracted.length, extractionExpectation: evidence.extraction,
    actions: evidence.run.actions.map((action) => ({
      actionType: action.actionType,
      status: action.status,
      ...(action.failure ? { failure: action.failure } : {}),
      ...(action.comparisonStatus ? { comparisonStatus: action.comparisonStatus } : {}),
      ...(action.targetResolution ? { targetResolution: action.targetResolution } : {}),
      ...(action.evidencePackets ? { evidencePackets: action.evidencePackets } : {}),
    })),
  };
}
