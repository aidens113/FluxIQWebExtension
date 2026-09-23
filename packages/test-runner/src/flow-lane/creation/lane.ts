// The created-Flow lane: a Flow is built by FluxIQ from a live instruction
// task rather than from a recording, then run and judged on the isolated
// target like any other Flow-lane run. The lane owns neither the credential nor
// Core's grant vocabulary; a live run hands it `authorizeBuild` and
// `settleBuild` for the build, and `authorizeRun` and `settleRun` for the
// repair its playback may make, and the lane decides only when each is used.

import type { ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import type { DeclaredSecret } from "../declared-secrets.js";
import { assertFlowFailure, type FlowExtractionJudgement } from "../expectations.js";
import { readFlowNodes } from "../flow-action-types.js";
import { flowLaneObservation, type RunLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowLlmExecution, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab, type LabResetFetch } from "../reset-scenario-lab.js";
import { assertFlowDidNotStopEarly } from "../run-flow-lane.js";
import { createBlankCreationFlow } from "./blank-flow.js";
import { buildCreatedFlowProposal, type CreatedFlowBuild, type CreatedFlowBuildControl, type CreatedFlowBuildWait, type CreatedFlowPermissionRequest } from "./build-proposal.js";
import { createdFlowActionTypes, createdFlowShape, type CreatedFlowShape } from "./flow-shape.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds, judgeCreatedFlowDataset } from "./judgement.js";
import { assertCreatedFlowReachesItsOwnPage, createdFlowOwnPage, type CreatedFlowOwnPage } from "./own-page.js";
import type { CreatedFlowRequest } from "./request.js";
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
  /** Whether the Flow can reach the page it works on, or whether the harness reached it for the Flow. */
  ownPage: CreatedFlowOwnPage;
  run: PersistedFlowRunOutcome;
  observation: RunLaneObservation;
  extraction: FlowExtractionJudgement | null;
}>;

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
 */
export async function runCreatedFlowLane(input: CreatedFlowLaneInput): Promise<CreatedFlowLaneEvidence> {
  const bounds = input.bounds ?? {};
  const { request, workflow, projectId, facilityRunId, authorizationPin } = input;
  if (workflow.workflowId !== request.workflowId || workflow.variant?.id !== request.variantId) {
    throw new RunnerFailure("fixture.invalid", "The created-Flow lane was handed a workflow other than the one its task resolved to");
  }
  const flowId = await createBlankCreationFlow(input.control, { projectId, name: `Lab created flow ${facilityRunId}`, authorizationPin }, bounds);
  await input.prepareFlowPage("build");
  const build = await buildCreatedFlowProposal(input.control, { projectId, flowId, instruction: request.task.instruction, authorize: input.authorizeBuild }, bounds, input.buildWait);
  await input.settleBuild(build);
  if (build.outcome === "permission_required" && build.permissionRequest) throw permissionRequired(build, build.permissionRequest);
  if (build.outcome !== "proposed" || build.adaptationId === null) {
    throw new RunnerFailure("runtime.behavior", `FluxIQ did not build a Flow from the task's instruction (${build.failure?.code ?? "no proposal"})`, {
      details: { failure: build.failure, providerCalls: build.providerCalls, providerInvocation: build.providerInvocation },
    });
  }
  const review = await applyCreatedFlowProposal(input.control, { projectId, flowId, adaptationId: build.adaptationId, authorizationPin });
  const nodes = await readFlowNodes(input.control, { projectId, flowId }, bounds);
  const actionTypes = createdFlowActionTypes(nodes, flowId);
  const shape = createdFlowShape(nodes, actionTypes);
  // Stated before the run and judged after it: the run publishes what the Flow
  // did either way, and a Flow that cannot reach its own page is the first
  // thing said about it.
  const ownPage = createdFlowOwnPage(request.task, shape);
  // A node on a sensitive control asks the run for its value under a path;
  // each request is answered by exactly one declared secret, or the run fails
  // here, before it starts.
  const secretInputs = createdFlowSecretInputs({ scenarioId: request.task.scenarioId, secrets: input.secrets, workflow, nodes });
  // Exploration may have acted on the page; the Flow is judged on state it produced itself.
  await resetScenarioLab(input.scenarioOrigin, input.runToken, input.fetchLab);
  await input.prepareFlowPage("playback");
  // Immediately before the run: Core expires the grant within the minute.
  const llmExecution = input.authorizeRun ? await input.authorizeRun(flowId) : undefined;
  let identifiedRunId: string | undefined;
  let run: PersistedFlowRunOutcome;
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
  const evidence: CreatedFlowLaneEvidence = Object.freeze({ request, build, review, flowId, shape, ownPage, run, observation, extraction });
  await input.recordEvidence(evidence);
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
