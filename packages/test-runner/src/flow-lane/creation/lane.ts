// The created-Flow lane: a Flow is built by FluxIQ from a live instruction
// task rather than from a recording, then run and judged on the isolated
// target like any other Flow-lane run. The lane owns neither the credential nor
// the Flow's LLM settings; a live run hands it `authorizeBuild` and
// `settleBuild` for the build, and `authorizeRun` and `settleRun` for the
// repair its playback may make, and the lane decides only when each is used.

import type { AuthoredFlowNode, ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure, type RunnerFailureCategory } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import type { DeclaredSecret } from "../declared-secrets.js";
import { assertFlowFailure, type FlowExtractionJudgement } from "../expectations.js";
import { readFlowNodes } from "../flow-action-types.js";
import { LAB_PROJECT_DOMAIN_ID } from "../lab-project-domain.js";
import { flowLaneObservation, type RunLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowLlmExecution, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab, type LabResetFetch } from "../reset-scenario-lab.js";
import { assertFlowDidNotStopEarly, flowActionsSnapshot } from "../run-flow-lane.js";
import { createBlankCreationFlow } from "./blank-flow.js";
import { buildCreatedFlowFromChat, type CreatedFlowChat, type CreatedFlowChatWait } from "./chat/index.js";
import { buildCreatedFlowProposal, type CreatedFlowBuild, type CreatedFlowBuildControl, type CreatedFlowBuildLlm, type CreatedFlowBuildWait, type CreatedFlowPermissionRequest } from "./build-proposal.js";
import { createdFlowAuthoredNodes } from "./authored-nodes.js";
import { createdFlowActionTypes, createdFlowShape, type CreatedFlowShape } from "./flow-shape.js";
import { judgeCreatedFlowDataset } from "./judgement.js";
import type { FinalStateVerdict } from "./final-state-facts.js";
import { assertCreatedFlowOracles, createdFlowOraclesHold, judgeCreatedFlowOracles, type CreatedFlowOracles } from "./oracles.js";
import { assertCreatedFlowReachesItsOwnPage, createdFlowOwnPage, type CreatedFlowOwnPage } from "./own-page.js";
import { judgeCreatedFlowPermissionStop, readCreatedFlowPermissionAsks, type CreatedFlowPermissionStop } from "./permission-point.js";
import { describeCreatedFlowRequest, type CreatedFlowRequest } from "./request.js";
import { applyCreatedFlowProposal, type CreatedFlowReview, type CreatedFlowReviewControl } from "./review-proposal.js";
import { createdFlowSecretInputs } from "./secrets.js";

/** The Core calls the lane makes; `ExistingFluxIQControlClient` satisfies it. */
export type CreatedFlowLaneControl = PersistedFlowRunControl & CreatedFlowBuildControl & CreatedFlowReviewControl;

/**
 * How a created Flow's build is started.
 *
 * - `chat`, the way a person starts one and the only way a run can pass: the
 *   task's instruction is typed into the extension's chat window beside the
 *   page (`chat/build-from-chat.ts`), and FluxIQ's chat creates, builds and
 *   applies the Flow itself. `authorizeChat` installs the run's model key in
 *   the person's Secret Keys before anything is typed; a chat build creates its
 *   Flow inside one Core command, so there is no Flow to pin settings to first
 *   and it runs on Core's own limits for a new Flow.
 * - `direct-api`, test-only (`--direct-api-build`): the Lab creates a blank
 *   Flow and calls Core's build endpoint itself, as the web panel's build
 *   button does. It never touches the chat, and a run built this way is never
 *   counted as a pass (`run-scenario.ts`).
 */
export type CreatedFlowLaneEntry =
  | Readonly<{ kind: "chat"; chat: CreatedFlowChat; authorizeChat: () => Promise<void>; wait?: CreatedFlowChatWait }>
  | Readonly<{ kind: "direct-api" }>;

/**
 * A build as its settlement left it: the record both snapshots carry, and where
 * its `instructedConsequences` came from -- Core's proposal, the run's step log
 * (a build that left no proposal), or neither.
 */
export type CreatedFlowSettledBuild = Readonly<{
  build: CreatedFlowBuild;
  instructedConsequencesFrom: "proposal" | "step_log" | null;
}>;

/** Where a settlement's answer rides on the error it threw; a symbol, so no serializer of the error ever writes it. */
const SETTLED_BUILD = Symbol("fluxiq.lab.settledBuild");

/**
 * `error` carrying `settled`, the answer a settlement had made before it
 * threw. The error is returned as it came -- same object, category, message
 * and details -- with the answer as a non-enumerable symbol property, which
 * `JSON.stringify` and the evidence bundle never read. A value that cannot
 * carry a property is returned unchanged.
 */
export function withSettledBuild(error: unknown, settled: CreatedFlowSettledBuild): unknown {
  if (error !== null && typeof error === "object" && Object.isExtensible(error)) {
    Object.defineProperty(error, SETTLED_BUILD, { value: settled, enumerable: false, configurable: true });
  }
  return error;
}

/** The settlement's answer a thrown error carries (`withSettledBuild`), if it carries one. */
export function settledBuildOf(error: unknown): CreatedFlowSettledBuild | undefined {
  return error !== null && typeof error === "object" ? (error as { [SETTLED_BUILD]?: CreatedFlowSettledBuild })[SETTLED_BUILD] : undefined;
}

/** Keeps the settled record as the lane's build, for both snapshots. */
function holdSettledBuild(progress: CreatedFlowLaneProgress, settled: CreatedFlowSettledBuild): void {
  progress.build = settled.build;
  progress.instructedConsequencesFrom = settled.instructedConsequencesFrom;
}

/**
 * What starting the build left: the Flow, its build, the change put into it
 * when the chat applied it, and FluxIQ's own words about it. A chat build's
 * words are on its record as well (`build.chat.said`, every ending), so
 * `flow-lane.json` keeps them on a created ending, where they used to be taken
 * only for the failure messages below (run-musp8nz1-dbd3905a, cause R1).
 */
type StartedBuild = { flowId: string | null; build: CreatedFlowBuild; buildPermitted: readonly string[]; applied: CreatedFlowReview | null; said: string | null; settlement?: unknown };

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
  /** How the build is started: from the extension's chat window, or, test-only, by the Lab calling Core's build endpoint itself (`CreatedFlowLaneEntry`). */
  entry: CreatedFlowLaneEntry;
  /** The direct build's hook: installs the key and saves the Flow's LLM settings and spend limit; answers with the consequences the operator permitted the build. A chat build calls `entry.authorizeChat` instead. */
  authorizeBuild: (flowId: string) => Promise<CreatedFlowBuildLlm>;
  /**
   * Publishes what the build spent and holds it to its caps, throwing on a
   * breach or on a build that reached no provider. Called once, before the
   * proposal is applied or anything is judged, whether the build proposed a
   * Flow or not.
   *
   * Answers with the build as it settled it, which is the record the lane
   * keeps from then on, so `flow-lane.json` and `live-llm.json` carry one
   * build. A live run's settlement fills `instructedConsequences` from the
   * run's step log when Core published none, which it does only on a proposal
   * (`run-murzln6g-11debe1d`, `S/0015`). A settlement that throws after it
   * settled the record -- a budget breach, a build that reached no provider --
   * carries its answer on the thrown error (`withSettledBuild`), so the
   * incomplete `flow-lane.json` of the run that most needs reading holds the
   * same build as `live-llm.json`. A settlement that throws without one leaves
   * the lane with the build as Core reported it.
   */
  settleBuild: (build: CreatedFlowBuild) => Promise<CreatedFlowSettledBuild>;
  /**
   * Readies the created Flow's playback for the model, against the Flow as the
   * review left it, and answers with the run's intent. With it, a Flow that
   * fails is diagnosed and repaired and the run's result is judged once it
   * ends. Absent, the playback carries no model and runs as deterministically
   * as it always has.
   */
  authorizeRun?: (flowId: string) => Promise<PersistedFlowLlmExecution>;
  /**
   * Publishes what the repair spent and holds it to its caps. Called once the
   * live run ends, before anything is judged, and also when the run
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
  /**
   * The fixture oracle: a goal task's whole judgement, and a dataset task's second one wherever its workflow declares a final state
   * (`oracles.ts`). It names each fact that did not hold (`final-state-facts.ts`), so a failed playback says what it missed.
   */
  judgeFinalState: () => Promise<FinalStateVerdict>;
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
  /** Each oracle the run was held to, and how it came out: the run passes only when none failed. */
  oracles: CreatedFlowOracles;
  /** Where `build.instructedConsequences` came from, as `live-llm.json` says it. */
  instructedConsequencesFrom: CreatedFlowSettledBuild["instructedConsequencesFrom"];
}>;

/**
 * A build that ended on its request at the task's declared permission point
 * (`permission-point.ts`): it asked where it should, and nobody allowed the act
 * in time, so no Flow was applied or run. Returned rather than thrown, because
 * asking there was right and not a lane fault; the run records it as
 * `stopped_for_permission` (`../../lane-rules/built-flow.ts`), which is never a
 * pass. A task's pass is the person allowing the act there and the Flow doing
 * it (`assertGrantedAtPermissionPoint`).
 */
export type CreatedFlowLanePermissionStop = Readonly<{
  request: CreatedFlowRequest;
  build: CreatedFlowBuild;
  flowId: string;
  permissionStop: Extract<CreatedFlowPermissionStop, { verdict: "at_declared_point" }>;
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
  /** `null` only for a build that stopped to ask at the task's declared permission point: no lane fault, and a `stopped_for_permission` run rather than a pass (`permissionStop`). */
  failure: { category: RunnerFailureCategory | null; message: string } | null;
  permissionStop?: CreatedFlowLanePermissionStop["permissionStop"];
  task: ReturnType<typeof describeCreatedFlowRequest>;
  /** How the build was started, as the complete snapshot says it: the lane's own entry, since a build that stopped may leave no chat record (`run-murdouox-c5294247`). */
  buildEntry: CreatedFlowLaneEntry["kind"];
  flowId: string | null;
  build: CreatedFlowBuild | null;
  /** Where `build.instructedConsequences` came from, as `live-llm.json` says it; `null` too when the settlement answered nothing. */
  instructedConsequencesFrom: CreatedFlowSettledBuild["instructedConsequencesFrom"];
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
  instructedConsequencesFrom?: CreatedFlowSettledBuild["instructedConsequencesFrom"];
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
 * With `authorizeRun`, the model takes part in the run, and does two jobs.
 * A created Flow that
 * fails is diagnosed and repaired in the same run, the way the product
 * promises -- "created and repaired" -- rather than refused for want of a
 * model; its repair is only ever proposed, so the Flow judged here is the Flow
 * the build made, and a proposal waits for a person's approval. And the run's
 * result is judged afterwards: Core's `loop_verification` runs, so
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
export async function runCreatedFlowLane(input: CreatedFlowLaneInput): Promise<CreatedFlowLaneEvidence | CreatedFlowLanePermissionStop> {
  const progress: CreatedFlowLaneProgress = { stage: "blank-flow", published: false };
  try {
    return await buildRunAndJudge(input, progress);
  } catch (error) {
    // Written once the lane has a Flow of its own to describe. A refusal before
    // that -- a workflow that is not the task's, a blank Flow Core did not leave
    // blank -- is stated in full by the failure itself, and an artifact of
    // nothing but nulls would say nothing by being present.
    // A chat build that made no Flow still has its build record -- what the chat
    // made of the instruction -- and that is the one artifact such a run needs.
    if ((progress.flowId !== undefined || progress.build !== undefined) && !progress.published && input.recordIncompleteEvidence) {
      await input.recordIncompleteEvidence(incompleteCreatedFlowLaneEvidence(input, progress, error))
        .catch(/* best-effort: the lane failure rethrown below is this run's finding and must not be replaced by a failed artifact write */ () => undefined);
    }
    throw error;
  }
}

async function buildRunAndJudge(input: CreatedFlowLaneInput, progress: CreatedFlowLaneProgress): Promise<CreatedFlowLaneEvidence | CreatedFlowLanePermissionStop> {
  const bounds = input.bounds ?? {};
  const { request, workflow, projectId, facilityRunId, authorizationPin } = input;
  if (workflow.workflowId !== request.workflowId || workflow.variant?.id !== request.variantId) {
    throw new RunnerFailure("fixture.invalid", "The created-Flow lane was handed a workflow other than the one its task resolved to");
  }
  const started = input.entry.kind === "chat" ? await startChatBuild(input, input.entry, progress, bounds) : await startDirectBuild(input, progress, bounds);
  const { build, buildPermitted, said } = started;
  if (started.flowId === null) {
    throw new RunnerFailure("runtime.behavior", `FluxIQ's chat did not build a Flow from the task's instruction (${build.failure?.code ?? "no Flow"})${said ? `; it said: ${JSON.stringify(said)}` : ""}`, {
      details: { failure: build.failure, chat: build.chat ?? null },
      ...(started.settlement === undefined ? {} : { cause: started.settlement }),
    });
  }
  const flowId = started.flowId;
  if (build.outcome === "permission_required" && build.permissionRequest) {
    const stop = judgeCreatedFlowPermissionStop(request.task, build.permissionRequest);
    if (stop.verdict !== "at_declared_point") throw permissionRequired(build, build.permissionRequest, stop);
    const stopped: CreatedFlowLanePermissionStop = Object.freeze({ request, build, flowId, permissionStop: stop });
    progress.published = true;
    await input.recordIncompleteEvidence?.({ ...incompleteCreatedFlowLaneEvidence(input, progress, undefined), permissionStop: stop });
    return stopped;
  }
  // A task whose instruction says to ask first has no right ending but the stop above, which is `stopped_for_permission` and not a pass: a Flow built without asking is wrong however right its records, and is never applied.
  if (request.task.permissionPoint?.askFirst && build.outcome === "proposed") {
    throw new RunnerFailure("runtime.behavior", "The task says to ask before its lasting act, and FluxIQ built a Flow without asking", { details: { permissionPoint: "not_asked", consequence: request.task.permissionPoint.consequence, adaptationId: build.adaptationId } });
  }
  if (build.outcome !== "proposed" || build.adaptationId === null) {
    throw new RunnerFailure("runtime.behavior", `FluxIQ did not build a Flow from the task's instruction (${build.failure?.code ?? "no proposal"})${said ? `; it said: ${JSON.stringify(said)}` : ""}`, {
      details: { failure: build.failure, providerCalls: build.providerCalls, providerInvocation: build.providerInvocation, ...(build.chat ? { chat: build.chat } : {}) },
    });
  }
  await assertGrantedAtPermissionPoint(input, { flowId, adaptationId: build.adaptationId, buildPermitted, ...(build.chat ? { conversationId: build.chat.conversationId } : {}) }, bounds);
  progress.stage = "review";
  // The chat approves and applies its own proposal on the Flow it made; only a direct build is reviewed by the Lab.
  const review = started.applied ?? await applyCreatedFlowProposal(input.control, { projectId, flowId, adaptationId: build.adaptationId, authorizationPin });
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
  // Before the run: the playback's LLM settings are saved on the Flow.
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
  const oracles = await judgeCreatedFlowOracles({ extraction, declaresFinalState: (workflow.expected.finalState?.length ?? 0) > 0, judgeFinalState: input.judgeFinalState });
  const oracleHeld = createdFlowOraclesHold(oracles);
  const observation = flowLaneObservation({
    flowCreated: true,
    oracleVerdict: oracleHeld ? "passed" : "failed",
    run,
    automationFailureExpected: workflow.expected.failure ?? null,
    extraction: extraction?.measurements ?? [],
  });
  const evidence: CreatedFlowLaneEvidence = Object.freeze({ request, build, review, flowId, shape, authoredNodes, ownPage, run, observation, extraction, oracles, instructedConsequencesFrom: progress.instructedConsequencesFrom ?? null });
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
  assertCreatedFlowOracles(extraction, oracles);
  return evidence;
}

/**
 * The direct build, test-only: a blank Flow, the build endpoint called by the
 * Lab with the start page and the operator's permit, and the proposal left for
 * the Lab's own review below.
 */
async function startDirectBuild(input: CreatedFlowLaneInput, progress: CreatedFlowLaneProgress, bounds: FluxIQHttpOptions): Promise<StartedBuild> {
  const { projectId, authorizationPin, facilityRunId, request } = input;
  const flowId = await createBlankCreationFlow(input.control, { projectId, name: `Lab created flow ${facilityRunId}`, authorizationPin }, bounds);
  progress.flowId = flowId;
  progress.stage = "build";
  await input.prepareFlowPage("build");
  // What the operator permitted the build (`--llm-permit`), kept so the verdict knows whether the task's act needed a person at all.
  let buildPermitted: readonly string[] = [];
  const authorize = async (id: string) => {
    const llm = await input.authorizeBuild(id);
    buildPermitted = llm.permittedConsequences;
    return llm;
  };
  const proposed = await buildCreatedFlowProposal(input.control, { projectId, flowId, instruction: request.task.instruction, startLocation: input.startLocation, authorize }, bounds, input.buildWait);
  // Held before the settlement and before either refusal after it, which are the
  // two endings that used to leave a run with no artifact at all.
  progress.build = proposed;
  const settled = await input.settleBuild(proposed).catch((error: unknown) => {
    const carried = settledBuildOf(error);
    if (carried) holdSettledBuild(progress, carried);
    throw error;
  });
  holdSettledBuild(progress, settled);
  const { build } = settled;
  return { flowId, build, buildPermitted, applied: null, said: null };
}

/**
 * The chat build: the person's key installed, the run's project selected for
 * the paired extension, and the task's instruction typed into the chat beside
 * the page FluxIQ is to start from. FluxIQ's chat creates the Flow, builds it
 * and applies its own proposal, so what comes back is a Flow already holding
 * its steps -- or a build record saying why there is none.
 *
 * The chat carries no operator permit: a lasting act is asked about in the
 * thread and answered there by the Lab's person, at the task's point.
 */
async function startChatBuild(input: CreatedFlowLaneInput, entry: Extract<CreatedFlowLaneEntry, { kind: "chat" }>, progress: CreatedFlowLaneProgress, bounds: FluxIQHttpOptions): Promise<StartedBuild> {
  const { projectId } = input;
  progress.stage = "build";
  await input.prepareFlowPage("build");
  await entry.authorizeChat();
  // The chat's thread and the build it starts belong to the project the paired extension has selected.
  await input.control.selectExistingContext(projectId, undefined, bounds);
  const made = await buildCreatedFlowFromChat(input.control, entry.chat, { projectId, domainId: input.projectDomainId ?? LAB_PROJECT_DOMAIN_ID, instruction: input.request.task.instruction }, entry.wait);
  if (made.flowId !== null) progress.flowId = made.flowId;
  progress.build = made.build;
  // A chat that built nothing spent nothing on a build, so the settlement's
  // "reached no provider" is not what went wrong -- what the chat made of the
  // instruction is, and it is raised below with this as its cause. An
  // overspend still outranks everything.
  let settlement: unknown;
  let build = made.build;
  await input.settleBuild(made.build).then((settled) => {
    build = settled.build;
    holdSettledBuild(progress, settled);
  }, (error: unknown) => {
    // Held whichever way the error goes: thrown on below, or kept as the cause of the chat's own failure.
    const carried = settledBuildOf(error);
    if (carried) {
      build = carried.build;
      holdSettledBuild(progress, carried);
    }
    if (made.flowId !== null || (error instanceof RunnerFailure && error.category === "performance.budget")) throw error;
    settlement = error;
  });
  if (made.applied && made.applied.appliedMutationCount < 1) {
    throw new RunnerFailure("runtime.behavior", "FluxIQ's chat applied the build's proposal but Core reported no change to the Flow", { details: { adaptationId: made.applied.adaptationId, chat: build.chat ?? null } });
  }
  return { flowId: made.flowId, build, buildPermitted: [], applied: made.applied ? Object.freeze({ ...made.applied }) : null, said: made.said, settlement };
}

/**
 * A consequential task whose act the build was not permitted gets a Flow one
 * honest way: the build asked a person at the task's permission point and the
 * person allowed it there, so the build went on and the Flow does the act.
 *
 * The Lab plays that person (`person-simulation/`), and the answer is read
 * back from Core's own record on the Flow's thread, not from the Lab. A Flow
 * proposed with no grant at the point -- nobody asked, the build asked about
 * another control, or the question was refused -- is a Flow that would do a
 * lasting act nobody allowed, and fails before it is applied. A task the
 * operator permitted the act (`--llm-permit`) had nothing to ask, and a task
 * that says to ask first was already held to its stop above.
 */
async function assertGrantedAtPermissionPoint(
  input: CreatedFlowLaneInput,
  build: { flowId: string; adaptationId: string; buildPermitted: readonly string[]; conversationId?: string },
  bounds: FluxIQHttpOptions,
): Promise<void> {
  const point = input.request.task.permissionPoint;
  if (!point || point.askFirst || build.buildPermitted.includes(point.consequence)) return;
  // A chat build asks in the chat it was started from, which is read as well as the Flow's own thread.
  const asked = await readCreatedFlowPermissionAsks(input.control, { projectId: input.projectId, domainId: input.projectDomainId ?? LAB_PROJECT_DOMAIN_ID, flowId: build.flowId, ...(build.conversationId ? { conversationId: build.conversationId } : {}) }, input.request.task, bounds);
  // A grant on a control Core left unnamed is not the person allowing the task's act: nobody could tell it was that act.
  if (asked.some(({ answer, stop }) => answer === "grant" && stop.verdict === "at_declared_point" && stop.control === "matched")) return;
  throw new RunnerFailure("runtime.behavior", "The task's lasting act needs a person's permission, and FluxIQ built a Flow without a person allowing it at the task's permission point", {
    details: {
      permissionPoint: "not_asked",
      consequence: point.consequence,
      adaptationId: build.adaptationId,
      // What the build did ask on its thread, if anything: ids and closed words, never the control's name.
      permissionAsks: asked.map(({ askId, status, answer, stop }) => ({ askId, status, answer, verdict: stop.verdict, ...(stop.verdict === "elsewhere" ? { reason: stop.reason } : {}) })),
    },
  });
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
    failure: error === undefined ? null : { category: error instanceof RunnerFailure ? error.category : null, message: error instanceof Error ? error.message : String(error) },
    task: describeCreatedFlowRequest(input.request),
    buildEntry: input.entry.kind,
    flowId: progress.flowId ?? null,
    build: progress.build ?? null,
    instructedConsequencesFrom: progress.instructedConsequencesFrom ?? null,
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
 * the run reports `permission.required` and the classes a later
 * `--llm-permit` must add, and records no Flow, because none can be applied until somebody
 * answers. Codes only -- the control's name stays on the build record, where
 * Core already bounded it.
 *
 * `adaptationId` is present when the build finished and left a proposal that
 * carries the unanswered question, and absent when the build ended on the
 * request itself. Both are the same ending for the run, and the difference is
 * worth keeping: the first has a Flow waiting behind an answer.
 */
function permissionRequired(build: CreatedFlowBuild, request: CreatedFlowPermissionRequest, stop: Extract<CreatedFlowPermissionStop, { verdict: "elsewhere" }>): RunnerFailure {
  const proposal = build.adaptationId === null ? "before building" : "after building";
  return new RunnerFailure("runtime.behavior", `FluxIQ asked for permission ${proposal} a Flow from the task's instruction (permission.required: ${request.missing.join(", ")})`, {
    details: {
      outcome: "permission.required",
      // Why this request is not the task's declared stop: none is declared, the run already permitted the declared class, or Core named another control.
      permissionPoint: stop.reason,
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
