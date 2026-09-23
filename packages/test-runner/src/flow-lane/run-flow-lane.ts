import type { ExpectedEvent, ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control/index.js";
import { declaredSecretBindingInputs, flowSecretRequests, type DeclaredSecret } from "./declared-secrets.js";
import { declaredUploadInputs, flowUploadRequests } from "./declared-uploads.js";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure, judgeFlowExtraction, type FlowExtractionJudgement } from "./expectations.js";
import { awaitFinalizedRecording, type FinalizedRecording, type FinalizedRecordingWait } from "./finalized-recording.js";
import { flowActionTypes, readFlowNodes, type FlowNodeRecord } from "./flow-action-types.js";
import { flowLaneObservation, type RunLaneObservation } from "./lane-observation.js";
import { extractionMismatchReport, extractionStepMismatches, type ExtractionDisclosureRule, type ExtractionMismatchReport } from "../run-expectations/index.js";
import { approveRecordingFlowProposal, assertProposalCoversRecording, createRecordingFlowProposal, type RecordingFlowProposal } from "./recording-flow-proposal.js";
import { executeRecordedFlowRun, type PersistedFlowLlmExecution, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "./persisted-flow-run.js";
import { absorbedEveryFailure, assertRecoveryAsDeclared, recoveryAttribution, recoveryAttributionSnapshot, type RunRecoveryAttribution } from "./recovery-attribution.js";
import { assertFlowRepair, judgeFlowRepair, type FlowRepairExpectation, type FlowRepairJudgement } from "./repair/index.js";
import { resetScenarioLab } from "./reset-scenario-lab.js";
import type { RecordingProposalControl } from "./recording-flow-proposal.js";

export type FlowLaneControl = PersistedFlowRunControl & RecordingProposalControl;

export type FlowLaneInput = {
  control: FlowLaneControl;
  projectId: string;
  /**
   * The domain the project is bound to. Core scopes a request to a domain from
   * `?domainId=` on the URL and refuses a dataset read whose scope is not the
   * project's own, so the lane has to name it to read back what an extraction
   * stored. Omitted by a caller that did not read the project: the Lab creates
   * every project it runs against in `LAB_PROJECT_DOMAIN_ID`, which is then
   * the default.
   */
  projectDomainId?: string;
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
  /**
   * Authorizes a live provider call against the Flow this lane just built, and
   * is called only when the run asked for one. The lane owns neither the
   * credential nor Core's grant vocabulary; it knows only that a run may carry
   * an authorization, and when in the sequence it has to be taken out -- after
   * the Flow exists, because the grant binds to it, and just before the run,
   * because Core expires it within the minute.
   */
  authorizeLiveLlm?: (flowId: string) => Promise<PersistedFlowLlmExecution>;
  /**
   * Told Core's run id for the Flow run the moment Core names it, and before
   * any read of the run or any expectation can fail the lane. A live run's
   * provider accounting is read from that run, and has to be read however the
   * lane then ends.
   */
  flowRunIdentified?: (runId: string) => void;
  /**
   * What a correct repair of this run looks like, where the workflow declares
   * one, judged against the proposal Core saved only when the run was
   * authorized to propose one (`judgeFlowRepair`). Absent, no repair is judged.
   */
  repairExpectation?: FlowRepairExpectation;
  bounds?: FluxIQHttpOptions;
};

/**
 * What the lane observed, handed to the runner before the expectations are
 * judged. `observation` is the run's `RunLaneObservation` as it stands then,
 * so a run whose expectations fail is still published as the Flow run it was.
 * `extraction` says whether the workflow's extraction expectation applied to
 * this Flow, and so whether it is judged.
 */
export type FlowLaneEvidence = { recording: FinalizedRecording; proposal: RecordingFlowProposal; flowId: string; run: PersistedFlowRunOutcome; observation: RunLaneObservation; extraction: FlowExtractionJudgement; startCandidateIndex: number | null; repair?: FlowRepairJudgement };

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
  extraction: FlowExtractionJudgement;
  /** Which recovery answered for each node, and at what cost. */
  recovery: RunRecoveryAttribution;
  startCandidateIndex: number | null;
  repair?: FlowRepairJudgement;
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
  // After the Flow exists and immediately before it runs: Core issues the grant
  // against this Flow's saved settings and expires it within the minute, so
  // nothing slow may come between the two.
  const llmExecution = input.authorizeLiveLlm ? await input.authorizeLiveLlm(approved.flowId) : undefined;
  // Just before the first Flow action can reach Core, whose runtime confirmation Core audits against the finalized recording.
  input.flowDispatchStarting(Date.now());
  const run = await executeRecordedFlowRun(input.control, {
    projectId: input.projectId,
    flowId: approved.flowId,
    facilityRunId: input.facilityRunId,
    ...(llmExecution ? { llmExecution } : {}),
    ...(input.projectDomainId === undefined ? {} : { domainId: input.projectDomainId }),
    ...(input.flowRunIdentified ? { onRunIdentified: input.flowRunIdentified } : {}),
    actionTypes,
    candidateOrder,
    // Each declared value and each supplied file once, under the path a node reads: Core persists a run's inputs, so any further copy is a copy on disk.
    inputs: { ...secretInputs, ...uploadInputs, scenarioId: input.scenario.id, facilityRunId: input.facilityRunId },
  }, bounds);
  const expected = input.workflow.expected;
  // Judged before the oracle and the publish, and never throwing: the
  // measurements are what the bench's extraction numbers are computed from, so
  // a run whose expectations fail must still publish them.
  const extraction = judgeFlowExtraction({
    expected: expected.extracted,
    script: input.workflow.recordingScript,
    datasets: run.extracted,
    actionTypes,
    candidateOrder,
    durationsByNode: run.extractionDurationsByNode,
    scenarioOrigin: input.scenarioOrigin,
  });
  // The oracle and the publish both come before the asserts. An assert throws
  // on any mismatch, and a run that failed one used to leave the runner with no
  // Flow observation at all, so the category Core reported never reached the
  // evaluation. Consulting the oracle first costs a failing run the oracle's
  // wait and buys it a real `oracleVerdict` instead of a null.
  const oracleHeld = await input.checkFinalState();
  // Every failure this run met was recovered from, so the failure record Core
  // kept describes an attempt rather than the run.
  const absorbed = absorbedEveryFailure(run.actions);
  const observation = flowLaneObservation({
    flowCreated: true,
    oracleVerdict: oracleHeld ? "passed" : "failed",
    run,
    automationFailureExpected: expected.failure ?? null,
    extraction: extraction.measurements,
  });
  // Where the run started, in the recording's order: 0 is the recording's first
  // action. Null when no attempt landed on an action node.
  const startCandidateIndex = run.startCandidateIndex ?? null;
  // Judged only for a run whose grant could propose a repair, and published
  // with the rest before any expectation is asserted.
  const repair = input.repairExpectation && llmExecution && llmExecution.purpose !== "diagnosis_only"
    ? await judgeFlowRepair(input.control, { projectId: input.projectId, flowId: approved.flowId, run, expectation: input.repairExpectation }, bounds)
    : undefined;
  // Joined before the evidence is written, like every other measurement here:
  // a run whose declaration fails is exactly the run whose rung attribution has
  // to be readable.
  const recovery = recoveryAttribution(run.actions);
  await input.recordEvidence({ recording, proposal, flowId: approved.flowId, run, observation, extraction, startCandidateIndex, ...(repair ? { repair } : {}) });
  // Before the expectations, which would otherwise blame whichever later action
  // they name ("did not produce a web.dom.click action", W28 run 2). The start
  // comes first: a run that began at a later action also stops short of the
  // actions before it, and the start is the cause.
  assertFlowStartedAtFirstAction(startCandidateIndex, proposal.candidateIds.length);
  assertFlowDidNotStopEarly(run);
  assertFlowFailure(expected.failure, absorbed ? null : run.failure);
  assertFlowActions(expected.actions, run.actions);
  assertFlowExtraction(extraction);
  // After the actions, which name the node an unabsorbed fault stopped at, and
  // before the repair, which is the model's answer to a fault the runtime did
  // not absorb.
  assertRecoveryAsDeclared(expected.recovery, recovery);
  assertFlowRepair(repair);
  return { recording, proposal, flowId: approved.flowId, run, observation, extraction, recovery, startCandidateIndex, ...(repair ? { repair } : {}) };
}

/**
 * Each action node's position in the proposal's candidate order, which is the
 * recording's order, through the candidate id approval wrote onto the node.
 * Only action nodes need one, since they are the nodes a run's first action
 * attempt can land on. An action node with no link, or with a link to a
 * candidate this proposal does not hold, leaves the lane unable to say where
 * the recording begins, so the run is refused before it starts.
 */
/**
 * The extraction judgement as the snapshot states it: counts, statuses, and the
 * names of the expectation members this lane could not observe.
 *
 * `unjudged` is the point of the block. A reader who sees a green extraction
 * must be able to see what was *not* compared -- the pages an entry declared
 * and Core's run datasets do not record -- without opening this code, because
 * the alternative is a number that looks like a full judgement and is not.
 */
export function flowExtractionSnapshot(judgement: FlowExtractionJudgement) {
  return {
    expectation: judgement.expectation,
    extractNodes: judgement.extractNodes,
    extractSteps: judgement.steps.length,
    unpairedDatasets: judgement.unpairedDatasets,
    nonStringValues: judgement.nonStringValues,
    steps: judgement.steps.map((step) => ({
      stepIndex: step.stepIndex,
      status: step.measurement.status,
      expectedRecords: step.measurement.expectedRecords,
      observedRecords: step.measurement.observedRecords,
      comparedRecords: step.measurement.comparedRecords,
      matchedRecords: step.measurement.matchedRecords,
      expectedFields: step.measurement.expectedFields,
      presentFields: step.measurement.presentFields,
      unexpectedFields: step.measurement.unexpectedFields,
      nonStringValues: step.measurement.nonStringValues,
      unjudged: [...step.unjudged],
      // Core's own dataset flags, which are not the extraction's: `storeTruncated` is Core's per-run row cap.
      storeTruncated: step.dataset?.storeTruncated ?? null,
      invalidRows: step.dataset?.invalidCount ?? null,
      datasetPages: step.dataset?.pages ?? null,
    })),
  };
}

/**
 * The same judgement as `snapshots/extraction-mismatches.json` states it: for
 * each step that did not match, which record positions differed and what the
 * two sides held at the expectation's own fields.
 *
 * It is a second artifact rather than a block of the lane snapshot because the
 * two have opposite boundaries. `flowLaneSnapshot` promises counts, closed
 * names and Core's identifiers and no page text, and that promise is worth
 * more than one more block; this file exists to carry the values and states
 * its own limits and every withholding in its `policy` and `disclosure`
 * (`run-expectations/extraction/mismatches.ts`).
 *
 * `disclosure` is the run's, decided from the scenario rather than from the
 * records: a fixture that declares replay secrets has a secret on its page by
 * construction, so its observed values are withheld and said to be.
 */
export function flowExtractionMismatches(judgement: FlowExtractionJudgement, disclosure: ExtractionDisclosureRule): ExtractionMismatchReport {
  return extractionMismatchReport(judgement.steps.map((step) => extractionStepMismatches({
    stepIndex: step.stepIndex, stepId: step.stepId,
    // The narrowed entry: `pages` and `truncated` were removed because this
    // lane cannot observe them, and neither names a record or a field, so the
    // records compared here are the declared ones either way.
    entry: step.entries[0], records: step.dataset?.records ?? [],
    disclosure, context: judgement.comparison,
  })));
}

/**
 * Writes that report, and writes nothing when every record matched: an
 * artifact that is always present says nothing by being present, and a reader
 * who finds this file knows before opening it that something did not match.
 *
 * The disclosure rule is read off the scenario rather than off the records. A
 * fixture that declares replay secrets has a secret on its page by
 * construction, so its observed values are withheld and the artifact says so.
 */
export async function writeFlowExtractionMismatches(
  bundle: { writeStructured(bundlePath: string, value: unknown): Promise<unknown> },
  scenario: Pick<WebScenario, "secrets">,
  judgement: FlowExtractionJudgement | null,
): Promise<void> {
  if (!judgement) return;
  const report = flowExtractionMismatches(judgement, scenario.secrets?.length ? "scenario-declares-secrets" : "fixture-page");
  if (report.steps.length === 0) return;
  await bundle.writeStructured("snapshots/extraction-mismatches.json", report);
}

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
export function assertFlowDidNotStopEarly(run: PersistedFlowRunOutcome): void {
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
 * packets. `extraction` is what the lane made of the workflow's extraction:
 * whether it was judged, how many extract nodes the Flow held against how many
 * recorded extract steps, and one entry per step with its counts, the members
 * this lane could not observe, and Core's own dataset flags -- counts and
 * closed names only, never a field name or a record. Each action carries
 * Core's transition comparison status when Core reported one.
 * `stoppedWithoutFailedAttempt` is the run's early stop, by counts, or null
 * when it did not stop that way. `harnessRecovery` is what Core's recovery did
 * -- each intervention's kind and validation, each runtime patch attempt's kind,
 * flags and issue codes, and the adaptation and change proposal ids the run
 * created -- with `attempted: false` for a run that needed none; Core's
 * workspace is deleted after an isolated run, so this is the only place the
 * answer survives.
 */
export function flowLaneSnapshot(evidence: FlowLaneEvidence) {
  return {
    recording: { recordingId: evidence.recording.recordingId, entryCount: evidence.recording.entryCount, secondWait: { entriesAppendedAfterFirstPoll: evidence.recording.entriesAppendedWhileWaiting, waitMs: evidence.recording.waitedMs, polls: evidence.recording.polls } },
    proposalId: evidence.proposal.proposalId, mapperId: evidence.proposal.mapperId, candidateCount: evidence.proposal.candidateCount, proposalIssues: [...evidence.proposal.issues],
    flowId: evidence.flowId, runtimeRunId: evidence.run.runId, status: evidence.run.status,
    // The failure that decided the run, and beside it every fault the ladder
    // absorbed -- so a recovered miss is readable as recovered rather than
    // disappearing from the record along with the run's headline.
    harnessActivations: evidence.run.harnessActivations, failure: evidence.run.failure, recoveredFailures: evidence.run.recoveredFailures ?? [], stoppedWithoutFailedAttempt: evidence.run.stoppedWithoutFailedAttempt ?? null,
    harnessRecovery: evidence.run.harnessRecovery,
    // Where the run started in the recording's candidate order: 0 for its first action, null when no attempt landed on an action node.
    startCandidateIndex: evidence.startCandidateIndex ?? null,
    extraction: flowExtractionSnapshot(evidence.extraction),
    // Which recovery answered for each node, and what it cost in attempts,
    // derived here from the run's own attempts rather than carried in: there
    // is one source of truth for it, and it is the attempt list every reader
    // of this file already has. Read beside `snapshots/live-llm.json`'s
    // provider count, it is the whole adversarial measurement: the rung that
    // absorbed the condition, and the number of model calls it took to do it.
    recovery: recoveryAttributionSnapshot(recoveryAttribution(evidence.run.actions)),
    // The declared repair's judgement: a verdict, field names and codes, never the proposal's target. Null when none was judged.
    repair: evidence.repair ?? null,
    actions: flowActionsSnapshot(evidence.run),
  };
}

/**
 * Each attempt as a Flow-lane snapshot states it. `evidencePackets` is where
 * the evaluation reads evidence sizes from (`run-evaluation/flow-lane-evidence-sizes.ts`),
 * so every lane that writes `snapshots/flow-lane.json` writes its actions here.
 *
 * `nodeId` and `attemptIndex` are what make a retried node readable. The
 * snapshot is a flat list of attempts in Core's order, so until the node id
 * was published a node the ladder attempted three times and a Flow that
 * authored three identical actions produced the same list, and no rung could
 * be attributed to anything. With them, and with `retry` naming the rung that
 * asked for each attempt after the first, a reader can join a run's attempts
 * back into nodes and say which rung absorbed what.
 *
 * `durationMs` is published for the same reason: the "wait for readiness" rung
 * costs time and nothing else, so a rung that fires and a rung that does not
 * are indistinguishable without a per-attempt duration.
 */
export function flowActionsSnapshot(run: PersistedFlowRunOutcome) {
  return run.actions.map((action) => ({
    actionType: action.actionType,
    nodeId: action.nodeId,
    attemptIndex: action.attemptIndex,
    status: action.status,
    // Core's own clock for the attempt. With `durationMs` it gives the gap
    // between one attempt and the next, which is the only way to check that a
    // fixture whose condition is timed was met at the moment it claims.
    startedAt: action.startedAt,
    ...(action.durationMs === undefined ? {} : { durationMs: action.durationMs }),
    ...(action.retry ? { retry: action.retry } : {}),
    ...(action.readiness ? { readiness: action.readiness } : {}),
    ...(action.failure ? { failure: action.failure } : {}),
    ...(action.comparisonStatus ? { comparisonStatus: action.comparisonStatus } : {}),
    ...(action.targetResolution ? { targetResolution: action.targetResolution } : {}),
    ...(action.hostTargetResolution ? { hostTargetResolution: action.hostTargetResolution } : {}),
    ...(action.evidencePackets ? { evidencePackets: action.evidencePackets } : {}),
  }));
}
