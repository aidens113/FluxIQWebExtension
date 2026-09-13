import type { ExpectedEvent, ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";
import { declaredSecretBindingInputs, flowSecretRequests, type DeclaredSecret } from "./declared-secrets.js";
import { declaredUploadInputs, flowUploadRequests } from "./declared-uploads.js";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure, flowExtractionExpectation, type FlowExtractionExpectation } from "./expectations.js";
import { awaitFinalizedRecording, type FinalizedRecording, type FinalizedRecordingWait } from "./finalized-recording.js";
import { flowActionTypes, readFlowNodes, type FlowNodeRecord } from "./flow-action-types.js";
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
export type FlowLaneEvidence = { recording: FinalizedRecording; proposal: RecordingFlowProposal; flowId: string; run: PersistedFlowRunOutcome; observation: RunLaneObservation; extraction: FlowExtractionExpectation; startCandidateIndex: number | null };

/**
 * `startCandidateIndex` is where the run started in the recording's candidate
 * order: 0 for the recording's first action, or null when no attempt landed on
 * an action node.
 */
export type FlowLaneOutcome = {
  recording: FinalizedRecording;
  proposal: RecordingFlowProposal;
  flowId: string;
  run: PersistedFlowRunOutcome;
  observation: RunLaneObservation;
  extraction: FlowExtractionExpectation;
  startCandidateIndex: number | null;
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
  // Read before running, and once: the same nodes answer every question below.
  const nodes = await readFlowNodes(input.control, { projectId: input.projectId, flowId: approved.flowId }, bounds);
  // The map identifies each attempt, and a Flow whose nodes dispatch no output
  // could not have run the recording at all.
  const actionTypes = flowActionTypes(nodes, approved.flowId);
  // Each action node's place in the recording's order, so the run's start is
  // judged against the recording rather than against Core's start rule. An
  // action node linked to no candidate of this proposal fails here, before the
  // run starts.
  const candidateOrder = recordedCandidateOrder(nodes, actionTypes, proposal, approved.flowId);
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
    candidateOrder,
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
  // Where the run started, in the recording's order: 0 is the recording's first
  // action. Null when no attempt landed on an action node.
  const startCandidateIndex = run.startCandidateIndex ?? null;
  await input.recordEvidence({ recording, proposal, flowId: approved.flowId, run, observation, extraction, startCandidateIndex });
  // Before the expectations, which would otherwise blame whichever later action
  // they name ("did not produce a web.dom.click action", W28 run 2). The start
  // comes first: a run that began at a later action also stops short of the
  // actions before it, and the start is the cause.
  assertFlowStartedAtFirstAction(startCandidateIndex, proposal.candidateIds.length);
  assertFlowDidNotStopEarly(run);
  assertFlowFailure(expected.failure, run.failure);
  assertFlowActions(expected.actions, run.actions);
  assertFlowExtraction(expected.extracted, run.extracted, actionTypes);
  return { recording, proposal, flowId: approved.flowId, run, observation, extraction, startCandidateIndex };
}

/**
 * Each action node's position in the proposal's candidate order, which is the
 * recording's order, through the candidate id approval wrote onto the node.
 * Only action nodes need one, since they are the nodes a run's first action
 * attempt can land on. An action node with no link, or with a link to a
 * candidate this proposal does not hold, leaves the lane unable to say where
 * the recording begins, so the run is refused before it starts.
 */
function recordedCandidateOrder(nodes: readonly FlowNodeRecord[], actionTypes: ReadonlyMap<string, string>, proposal: RecordingFlowProposal, flowId: string): Map<string, number> {
  const positions = new Map(proposal.candidateIds.map((candidateId, index) => [candidateId, index] as const));
  const order = new Map<string, number>();
  let unlinkedActionNodes = 0;
  for (const node of nodes) {
    if (!actionTypes.has(node.id)) continue;
    const position = node.recordingCandidateId === undefined ? undefined : positions.get(node.recordingCandidateId);
    if (position === undefined) unlinkedActionNodes += 1;
    else order.set(node.id, position);
  }
  if (unlinkedActionNodes) {
    throw new RunnerFailure("recording.contract", "The approved Flow has action nodes linked to no candidate of the recording's proposal, so where the recording begins cannot be identified", { details: { flowId, unlinkedActionNodes, candidateCount: proposal.candidateIds.length } });
  }
  return order;
}

/**
 * A run whose first action attempt is not the recording's first action ran the
 * recording from the wrong place: W15 started at its tab close 7 of 7 times, and
 * W28's run 2 at its last scroll (`i-w15-w28-flow-order`). It fails as exactly
 * that, by the candidate's position. Node ids and Core's start rule are not part
 * of the judgement, so it holds whatever start rule Core uses.
 */
function assertFlowStartedAtFirstAction(startCandidateIndex: number | null, candidateCount: number): void {
  if (startCandidateIndex === 0) return;
  if (startCandidateIndex === null) {
    throw new RunnerFailure("action.dispatch", "The Flow's attempts name none of its action nodes, so the run cannot be shown to start at the recording's first action", { details: { candidateCount } });
  }
  throw new RunnerFailure("action.dispatch", `The Flow started at recorded action ${startCandidateIndex + 1} of ${candidateCount}, not at the recording's first action`, { details: { startCandidateIndex, candidateCount } });
}

/**
 * A run Core failed while every attempt succeeded and some recorded action was
 * never attempted is a stop, not an action failure. It fails as exactly that,
 * by counts: node ids and Core's message are not part of it.
 */
function assertFlowDidNotStopEarly(run: PersistedFlowRunOutcome): void {
  const stop = run.stoppedWithoutFailedAttempt;
  if (!stop) return;
  throw new RunnerFailure(
    "action.dispatch",
    `The Flow stopped with ${stop.unvisitedActions} recorded action(s) never attempted and no failed attempt, after ${stop.attemptedActions} action(s) succeeded`,
    { details: { attemptedActions: stop.attemptedActions, unvisitedActions: stop.unvisitedActions } },
  );
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
 * comparison status when Core reported one. `stoppedWithoutFailedAttempt` is
 * the run's early stop, by counts, or null when it did not stop that way.
 */
export function flowLaneSnapshot(evidence: FlowLaneEvidence) {
  return {
    recording: { recordingId: evidence.recording.recordingId, entryCount: evidence.recording.entryCount, secondWait: { entriesAppendedAfterFirstPoll: evidence.recording.entriesAppendedWhileWaiting, waitMs: evidence.recording.waitedMs, polls: evidence.recording.polls } },
    proposalId: evidence.proposal.proposalId, mapperId: evidence.proposal.mapperId, candidateCount: evidence.proposal.candidateCount, proposalIssues: [...evidence.proposal.issues],
    flowId: evidence.flowId, runtimeRunId: evidence.run.runId, status: evidence.run.status,
    harnessActivations: evidence.run.harnessActivations, failure: evidence.run.failure, stoppedWithoutFailedAttempt: evidence.run.stoppedWithoutFailedAttempt ?? null,
    // Where the run started in the recording's candidate order: 0 for its first action, null when no attempt landed on an action node.
    startCandidateIndex: evidence.startCandidateIndex ?? null,
    extractionCount: evidence.run.extracted.length, extractionExpectation: evidence.extraction,
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
