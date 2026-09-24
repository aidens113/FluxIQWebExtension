// The created-Flow lane: a Flow is built by FluxIQ from a live instruction
// task rather than from a recording, then run and judged on the isolated
// target like any other Flow-lane run. The lane owns neither the credential nor
// Core's grant vocabulary; a live run hands it `authorizeBuild` and
// `settleBuild` for the build, and `authorizeRun` and `settleRun` for the
// repair its playback may make, and the lane decides only when each is used.

import type { AuthoredFlowNode, ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure, type RunnerFailureCategory } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import type { DeclaredSecret } from "../declared-secrets.js";
import { assertFlowFailure, type FlowExtractionJudgement } from "../expectations.js";
import { readFlowNodes } from "../flow-action-types.js";
import { flowLaneObservation, type RunLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowLlmExecution, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab, type LabResetFetch } from "../reset-scenario-lab.js";
import { assertFlowDidNotStopEarly, flowActionsSnapshot } from "../run-flow-lane.js";
import { createBlankCreationFlow } from "./blank-flow.js";
import { buildCreatedFlowProposal, type CreatedFlowBuild, type CreatedFlowBuildControl, type CreatedFlowBuildWait, type CreatedFlowPermissionRequest } from "./build-proposal.js";
import { createdFlowAuthoredNodes } from "./authored-nodes.js";
import { createdFlowActionTypes, createdFlowShape, type CreatedFlowShape } from "./flow-shape.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds, judgeCreatedFlowDataset } from "./judgement.js";
import { assertCreatedFlowReachesItsOwnPage, createdFlowOwnPage, type CreatedFlowOwnPage } from "./own-page.js";
import { describeCreatedFlowRequest, type CreatedFlowRequest } from "./request.js";
import { applyCreatedFlowProposal, type CreatedFlowReview, type CreatedFlowReviewControl } from "./review-proposal.js";
import { createdFlowSecretInputs } from "./secrets.js";

/** The Core calls the lane makes; `ExistingFluxIQControlClient` satisfies it. */
export type CreatedFlowLaneControl = PersistedFlowRunControl & CreatedFlowBuildControl & CreatedFlowReviewControl;

export type CreatedFlowLaneInput = {
  control: CreatedFlowLaneControl;
  projectId: string;
  /** The project's domain, as `FlowLaneInput.projectDomainId`; the Lab's own by default. */
  projectDomainId?: string;
  authorizationPin: string;
  request: CreatedFlowRequest;
  /** The workflow `request` resolved to, with its variant applied: its expectations judge the run. */
  workflow: ResolvedScenarioWorkflow;
  facilityRunId: string;
  scenarioOrigin: string;
  /**
   * The fixture's entry point, as the harness would have opened it, told to
   * Core as where the built Flow starts.
   *
   * It is the run's own value and not the catalog's: no instruction names a
   * destination, and the origin is a loopback port drawn at allocation time, so
   * nothing written down before the run could have carried it. The build is
   * then not given this page -- it has to go there itself, and because a Flow
   * is assembled from the steps that ran, the step that goes there is the
   * Flow's own first step (`AS/runtime/flow-bootstrap/start-location.ts`).
   */
  startLocation: string;
  runToken: string;
  /** The declared secrets the task's workflow needs (`resolveCreatedFlowSecrets`); the runner also adds their values to the evidence redaction list. */
  secrets: readonly DeclaredSecret[];
  /** Installs the key, pins the Flow's settings and issues the `build_and_adapt` grant, against the Flow as it then stands. */
  authorizeBuild: (flowId: string) => Promise<{ grantId: string }>;
  /**
   * Publishes what the build spent and holds it to its caps, throwing on a
   * breach or on a build that reached no provider. Called once, before the
   * proposal is applied or anything is judged, whether the build proposed a
   * Flow or not.
   */
  settleBuild: (build: CreatedFlowBuild) => Promise<void>;
  /**
   * Issues the proposal-only repair grant the created Flow's playback runs
   * under, against the Flow as the review left it. With it, a Flow that fails
   * is diagnosed and repaired, every change is held as a proposal awaiting
   * approval, and the run's result is judged once it ends. Absent, the
   * playback carries no grant and runs as deterministically as it always has.
   */
  authorizeRun?: (flowId: string) => Promise<PersistedFlowLlmExecution>;
  /**
   * Publishes what the repair spent and holds it to its caps. Called once the
   * granted run ends, before anything is judged, and also when the run
   * throws, with whatever run id Core had named by then.
   */
  settleRun?: (runId: string | undefined) => Promise<void>;
  /**
   * Presents the task's rendering: arms its variant, if any, loads the
   * scenario's start page and checks the armed facts. Called before the build,
   * so FluxIQ explores the page the Flow will meet, and again after the
   * fixture's state is reset, before the run. `moment` says which: a task
   * whose variant is armed after the build is explored unarmed.
   *
   * **At `"playback"` it presents the page the Flow is about to be judged on --
   * except for a task whose instruction begins by going somewhere, which is
   * left the blank tab a browser opens on, because loading that page is the one
   * step such a Flow is being measured on.** Which it is belongs to the caller
   * (`lane-rules/flow-start-page.ts`), taken from the same rule the lane judges
   * by (`own-page.ts`); either way the tab no longer shows whatever the
   * exploration left on screen, which is what the lane needs from it.
   */
  prepareFlowPage: (moment: "build" | "playback") => Promise<void>;
  /** Records what the Flow did, before any expectation is judged. */
  recordEvidence: (evidence: CreatedFlowLaneEvidence) => Promise<void>;
  /**
   * Records what the lane knew when it could not finish, so the run that most
   * needs reading is not the one with no artifact. `recordEvidence` above runs
   * only once a Flow has been built, applied, read and run, so every failure
   * before that -- a build that proposed nothing or asked for a permission, a
   * Flow with no action node, a secret no declaration answers, a run that threw
   * -- left `snapshots/flow-lane.json` absent altogether. The specimen is
   * `run-muf8dstp-0135804a` (2026-09-24), a multi-step run whose build failed
   * and whose bundle then said nothing about what was asked, what the build
   * spent, or what it made. This is called once instead, and the lane's own
   * failure is rethrown either way.
   */
  recordIncompleteEvidence?: (evidence: CreatedFlowLaneIncomplete) => Promise<unknown>;
  /** The fixture oracle for a task judged by its playback goal. Not consulted for a dataset task. */
  checkFinalState: () => Promise<boolean>;
  bounds?: FluxIQHttpOptions;
  buildWait?: CreatedFlowBuildWait;
  fetchLab?: LabResetFetch;
};

/** `extraction` is the dataset judgement, `null` for a task judged by its playback goal. */
export type CreatedFlowLaneEvidence = Readonly<{
  request: CreatedFlowRequest;
  build: CreatedFlowBuild;
  review: CreatedFlowReview;
  flowId: string;
  shape: CreatedFlowShape;
  /**
   * What each action node of the built Flow was told to do, screened.
   *
   * `shape` says how many nodes of each output the build made; this says with
   * what. Six live `product-catalog` runs failed with `expectedRecords 8,
   * observedRecords 23` -- a Flow that walked all three fixture pages for an
   * instruction asking for the first -- and could not be diagnosed, because no
   * artifact recorded whether the extraction node had been authored to
   * paginate.
   */
  authoredNodes: readonly AuthoredFlowNode[];
  /** Whether the Flow can reach the page it works on, or whether the harness reached it for the Flow. */
  ownPage: CreatedFlowOwnPage;
  run: PersistedFlowRunOutcome;
  observation: RunLaneObservation;
  extraction: FlowExtractionJudgement | null;
}>;

/** Where a lane that could not finish stopped, named in the order the lane does the work. */
export type CreatedFlowLaneStage = "blank-flow" | "build" | "review" | "flow-read" | "secrets" | "playback-page" | "run" | "judgement" | "publish" | "expectations";

/**
 * The `snapshots/flow-lane.json` a lane that could not finish writes: the
 * complete document's own fields, with `complete: false`, the stage it stopped
 * at, the failure that stopped it, and `null` for everything never reached.
 * Every field is a subset of what `createdFlowLaneSnapshot` already publishes
 * -- identifiers, closed names, counts and the screened authored nodes -- so
 * nothing a page supplied is disclosed here that a finished run withheld.
 */
export type CreatedFlowLaneIncomplete = Readonly<{
  lane: "created-flow";
  complete: false;
  stoppedAt: CreatedFlowLaneStage;
  failure: { category: RunnerFailureCategory | null; message: string };
  task: ReturnType<typeof describeCreatedFlowRequest>;
  flowId: string | null;
  build: CreatedFlowBuild | null;
  review: CreatedFlowReview | null;
  flowShape: CreatedFlowShape | null;
  authoredNodes: readonly AuthoredFlowNode[] | null;
  ownPage: CreatedFlowOwnPage | null;
  runtimeRunId: string | null;
  status: PersistedFlowRunOutcome["status"] | null;
  resultVerification: PersistedFlowRunOutcome["resultVerification"] | null;
  runFailure: PersistedFlowRunOutcome["failure"];
  recoveredFailures: NonNullable<PersistedFlowRunOutcome["recoveredFailures"]>;
  route: PersistedFlowRunOutcome["route"];
  harnessActivations: PersistedFlowRunOutcome["harnessActivations"] | null;
  actions: ReturnType<typeof flowActionsSnapshot>;
}>;

/** What the lane has learned so far, filled in as it goes so a failure can be written down beside it. */
type CreatedFlowLaneProgress = {
  stage: CreatedFlowLaneStage;
  published: boolean;
  flowId?: string;
  build?: CreatedFlowBuild;
  review?: CreatedFlowReview;
  shape?: CreatedFlowShape;
  authoredNodes?: readonly AuthoredFlowNode[];
  ownPage?: CreatedFlowOwnPage;
  run?: PersistedFlowRunOutcome;
};

/**
 * Creates a blank Flow, presents the task's rendering, has FluxIQ explore it
 * and propose a Flow for the task's instruction, settles the build, approves
 * and applies the proposal, resets the fixture, presents the page again, runs
 * the created Flow, and judges it: by the stored records for a dataset task,
 * by the scenario's playback goal otherwise.
 *
 * With `authorizeRun`, the run carries one proposal-only repair grant
 * (`diagnose_and_adapt`), and that grant does two jobs. A created Flow that
 * fails is diagnosed and repaired in the same run, the way the product
 * promises -- "created and repaired" -- rather than refused for want of a
 * model; its repair is only ever proposed, so the Flow judged here is the Flow
 * the build made, and a proposal waits for a person's approval. And the run's
 * result is judged afterwards: the grant covers Core's `loop_verification`, so
 * Core asks whether what came back answers what was asked, rather than
 * recording that nobody judged it and keeping a `succeeded` that is
 * indistinguishable from a right answer. Without `authorizeRun` the run is
 * deterministic and unjudged, as it always was.
 *
 * However it ends, the lane writes down what it knew: `recordEvidence` when it
 * reached the judgement, and `recordIncompleteEvidence` when it did not. The
 * failure is rethrown unchanged either way, so the artifact is added to the
 * run's record rather than taken out of its verdict.
 */
export async function runCreatedFlowLane(input: CreatedFlowLaneInput): Promise<CreatedFlowLaneEvidence> {
  const progress: CreatedFlowLaneProgress = { stage: "blank-flow", published: false };
  try {
    return await buildRunAndJudge(input, progress);
  } catch (error) {
    // Written once the lane has a Flow of its own to describe. A refusal before
    // that -- a workflow that is not the task's, a blank Flow Core did not leave
    // blank -- is stated in full by the failure itself, and an artifact of
    // nothing but nulls would say nothing by being present.
    if (progress.flowId !== undefined && !progress.published && input.recordIncompleteEvidence) {
      await input.recordIncompleteEvidence(incompleteCreatedFlowLaneEvidence(input, progress, error))
        .catch(/* best-effort: the lane failure rethrown below is this run's finding and must not be replaced by a failed artifact write */ () => undefined);
    }
    throw error;
  }
}

async function buildRunAndJudge(input: CreatedFlowLaneInput, progress: CreatedFlowLaneProgress): Promise<CreatedFlowLaneEvidence> {
  const bounds = input.bounds ?? {};
  const { request, workflow, projectId, facilityRunId, authorizationPin } = input;
  if (workflow.workflowId !== request.workflowId || workflow.variant?.id !== request.variantId) {
    throw new RunnerFailure("fixture.invalid", "The created-Flow lane was handed a workflow other than the one its task resolved to");
  }
  const flowId = await createBlankCreationFlow(input.control, { projectId, name: `Lab created flow ${facilityRunId}`, authorizationPin }, bounds);
  progress.flowId = flowId;
  progress.stage = "build";
  await input.prepareFlowPage("build");
  const build = await buildCreatedFlowProposal(input.control, { projectId, flowId, instruction: request.task.instruction, startLocation: input.startLocation, authorize: input.authorizeBuild }, bounds, input.buildWait);
  // Held before the settlement and before either refusal below, which are the
  // two endings that used to leave a run with no artifact at all.
  progress.build = build;
  await input.settleBuild(build);
  if (build.outcome === "permission_required" && build.permissionRequest) throw permissionRequired(build, build.permissionRequest);
  if (build.outcome !== "proposed" || build.adaptationId === null) {
    throw new RunnerFailure("runtime.behavior", `FluxIQ did not build a Flow from the task's instruction (${build.failure?.code ?? "no proposal"})`, {
      details: { failure: build.failure, providerCalls: build.providerCalls, providerInvocation: build.providerInvocation },
    });
  }
  progress.stage = "review";
  const review = await applyCreatedFlowProposal(input.control, { projectId, flowId, adaptationId: build.adaptationId, authorizationPin });
  progress.review = review;
  progress.stage = "flow-read";
  const nodes = await readFlowNodes(input.control, { projectId, flowId }, bounds);
  const actionTypes = createdFlowActionTypes(nodes, flowId);
  const shape = createdFlowShape(nodes, actionTypes);
  progress.shape = shape;
  // Read from the same nodes and the same map as the shape, before the run
  // touches anything: this is the Flow as the build left it, which is the
  // document a later diagnosis needs and the one Core deletes with the
  // workspace when an isolated run ends.
  const authoredNodes = createdFlowAuthoredNodes(nodes, actionTypes);
  progress.authoredNodes = authoredNodes;
  // Stated before the run and judged after it: the run publishes what the Flow
  // did either way, and a Flow that cannot reach its own page is the first
  // thing said about it.
  const ownPage = createdFlowOwnPage(request.task, shape);
  progress.ownPage = ownPage;
  progress.stage = "secrets";
  // A node on a sensitive control asks the run for its value under a path;
  // each request is answered by exactly one declared secret, or the run fails
  // here, before it starts.
  const secretInputs = createdFlowSecretInputs({ scenarioId: request.task.scenarioId, secrets: input.secrets, workflow, nodes });
  progress.stage = "playback-page";
  // Exploration may have acted on the page; the Flow is judged on state it produced itself.
  await resetScenarioLab(input.scenarioOrigin, input.runToken, input.fetchLab);
  await input.prepareFlowPage("playback");
  // Immediately before the run: Core expires the grant within the minute.
  const llmExecution = input.authorizeRun ? await input.authorizeRun(flowId) : undefined;
  let identifiedRunId: string | undefined;
  let run: PersistedFlowRunOutcome;
  progress.stage = "run";
  try {
    run = await executeRecordedFlowRun(input.control, {
      projectId,
      flowId,
      facilityRunId,
      ...(input.projectDomainId === undefined ? {} : { domainId: input.projectDomainId }),
      actionTypes,
      ...(llmExecution ? { llmExecution } : {}),
      onRunIdentified: (runId) => { identifiedRunId = runId; },
      // Each declared value once, under the path a node reads: Core persists a run's inputs, so any further copy is a copy on disk.
      inputs: { ...secretInputs, scenarioId: request.task.scenarioId, facilityRunId },
    }, bounds);
  } catch (error) {
    // A repair that ran and then failed to be read back was still paid for. An
    // overspend outranks the lane's own failure; a settlement that could not
    // write its record must not hide why the lane failed.
    if (llmExecution && input.settleRun) {
      const breach = await input.settleRun(identifiedRunId).then(() => undefined, (settlement: unknown) => settlement);
      if (breach instanceof RunnerFailure) throw breach;
    }
    throw error;
  }
  progress.run = run;
  progress.stage = "judgement";
  if (llmExecution && input.settleRun) await input.settleRun(run.runId);
  const { judgement } = request;
  // Judged before the publish and never throwing, so a Flow whose records are wrong is still published with its measurement.
  const extraction = judgement.judgeBy === "expected-dataset" ? judgeCreatedFlowDataset({ workflow, stepId: judgement.stepId, run, actionTypes, scenarioOrigin: input.scenarioOrigin }) : null;
  const oracleHeld = extraction ? createdFlowDatasetHolds(extraction) : await input.checkFinalState();
  const observation = flowLaneObservation({
    flowCreated: true,
    oracleVerdict: oracleHeld ? "passed" : "failed",
    run,
    automationFailureExpected: workflow.expected.failure ?? null,
    extraction: extraction?.measurements ?? [],
  });
  const evidence: CreatedFlowLaneEvidence = Object.freeze({ request, build, review, flowId, shape, authoredNodes, ownPage, run, observation, extraction });
  progress.stage = "publish";
  await input.recordEvidence(evidence);
  // From here the complete snapshot is on disk, so a failing expectation below
  // must not have it overwritten by the partial one.
  progress.published = true;
  progress.stage = "expectations";
  // First of the judgements: a Flow that could not have started without the
  // harness produced its records from a page it never chose, so what those
  // records match or miss says nothing about the Flow.
  assertCreatedFlowReachesItsOwnPage(ownPage, { flowId, taskId: request.task.id, taskKind: request.task.kind });
  assertFlowDidNotStopEarly(run);
  assertFlowFailure(workflow.expected.failure, run.failure);
  if (extraction) assertCreatedFlowDataset(extraction);
  else if (!oracleHeld) throw new RunnerFailure("runtime.behavior", "The created Flow ran, but the scenario's playback goal did not hold afterwards");
  return evidence;
}

/**
 * What the lane knew when it stopped, in the complete snapshot's own
 * vocabulary, so a reader opens one document either way. The run's fields are
 * filled in for the failures that happen after the Flow ran and before it is
 * judged -- a repair settlement that breached its cap is the live one -- and
 * are `null` when no run was reached. `failure.message` is the string the
 * bundle already publishes as the run's failure, so it discloses nothing new.
 */
function incompleteCreatedFlowLaneEvidence(input: CreatedFlowLaneInput, progress: CreatedFlowLaneProgress, error: unknown): CreatedFlowLaneIncomplete {
  const run = progress.run;
  return {
    lane: "created-flow",
    complete: false,
    stoppedAt: progress.stage,
    failure: { category: error instanceof RunnerFailure ? error.category : null, message: error instanceof Error ? error.message : String(error) },
    task: describeCreatedFlowRequest(input.request),
    flowId: progress.flowId ?? null,
    build: progress.build ?? null,
    review: progress.review ?? null,
    flowShape: progress.shape ?? null,
    authoredNodes: progress.authoredNodes ?? null,
    ownPage: progress.ownPage ?? null,
    runtimeRunId: run?.runId ?? null,
    status: run?.status ?? null,
    resultVerification: run?.resultVerification ?? null,
    runFailure: run?.failure ?? null,
    recoveredFailures: run?.recoveredFailures ?? [],
    route: run?.route ?? null,
    harnessActivations: run?.harnessActivations ?? null,
    actions: run ? flowActionsSnapshot(run) : [],
  };
}

/**
 * The build asked a person, which is an answer and not a transport failure:
 * the run reports `permission.required` and the classes a later grant must
 * add, and records no Flow, because none can be applied until somebody
 * answers. Codes only -- the control's name stays on the build record, where
 * Core already bounded it.
 *
 * `adaptationId` is present when the build finished and left a proposal that
 * carries the unanswered question, and absent when the build ended on the
 * request itself. Both are the same ending for the run, and the difference is
 * worth keeping: the first has a Flow waiting behind an answer.
 */
function permissionRequired(build: CreatedFlowBuild, request: CreatedFlowPermissionRequest): RunnerFailure {
  const proposal = build.adaptationId === null ? "before building" : "after building";
  return new RunnerFailure("runtime.behavior", `FluxIQ asked for permission ${proposal} a Flow from the task's instruction (permission.required: ${request.missing.join(", ")})`, {
    details: {
      outcome: "permission.required",
      missing: [...request.missing],
      consequences: [...request.consequences],
      action: { kind: request.actionKind, verb: request.verb },
      instructed: request.instructed.map((entry) => entry.consequence),
      ...(build.adaptationId === null ? {} : { adaptationId: build.adaptationId }),
      failure: build.failure,
      providerCalls: build.providerCalls,
      providerInvocation: build.providerInvocation,
    },
  });
}
