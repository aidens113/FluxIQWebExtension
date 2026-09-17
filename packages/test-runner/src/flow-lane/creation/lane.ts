// The created-Flow lane: a Flow is built by FluxIQ from a live instruction
// task rather than from a recording, then run and judged on the isolated
// target like any other Flow-lane run. The lane owns neither the credential nor
// Core's grant vocabulary; a live run hands it `authorizeBuild` and
// `settleBuild`, and the lane decides only when each is used.

import type { ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import type { DeclaredSecret } from "../declared-secrets.js";
import { assertFlowFailure, type FlowExtractionJudgement } from "../expectations.js";
import { readFlowNodes } from "../flow-action-types.js";
import { flowLaneObservation, type RunLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab, type LabResetFetch } from "../reset-scenario-lab.js";
import { assertFlowDidNotStopEarly } from "../run-flow-lane.js";
import { createBlankCreationFlow } from "./blank-flow.js";
import { buildCreatedFlowProposal, type CreatedFlowBuild, type CreatedFlowBuildControl, type CreatedFlowBuildWait } from "./build-proposal.js";
import { createdFlowActionTypes, createdFlowShape, type CreatedFlowShape } from "./flow-shape.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds, judgeCreatedFlowDataset } from "./judgement.js";
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
   * Presents the task's rendering: arms its variant, if any, loads the
   * scenario's start page and checks the armed facts. Called before the build,
   * so FluxIQ explores the page the Flow will meet, and again after the
   * fixture's state is reset, before the run.
   */
  prepareFlowPage: () => Promise<void>;
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
  run: PersistedFlowRunOutcome;
  observation: RunLaneObservation;
  extraction: FlowExtractionJudgement | null;
}>;

/**
 * Creates a blank Flow, presents the task's rendering, has FluxIQ explore it
 * and propose a Flow for the task's instruction, settles the build, approves
 * and applies the proposal, resets the fixture, presents the page again, runs
 * the created Flow without a provider, and judges it: by the stored records
 * for a dataset task, by the scenario's playback goal otherwise.
 *
 * The run is deterministic. The build is the live part; a created Flow that
 * then needs the model to succeed has not been created well, and a later lane
 * repairs it under its own grant.
 */
export async function runCreatedFlowLane(input: CreatedFlowLaneInput): Promise<CreatedFlowLaneEvidence> {
  const bounds = input.bounds ?? {};
  const { request, workflow, projectId, facilityRunId, authorizationPin } = input;
  if (workflow.workflowId !== request.workflowId || workflow.variant?.id !== request.variantId) {
    throw new RunnerFailure("fixture.invalid", "The created-Flow lane was handed a workflow other than the one its task resolved to");
  }
  const flowId = await createBlankCreationFlow(input.control, { projectId, name: `Lab created flow ${facilityRunId}`, authorizationPin }, bounds);
  await input.prepareFlowPage();
  const build = await buildCreatedFlowProposal(input.control, { projectId, flowId, instruction: request.task.instruction, authorize: input.authorizeBuild }, bounds, input.buildWait);
  await input.settleBuild(build);
  if (build.outcome !== "proposed" || build.adaptationId === null) {
    throw new RunnerFailure("runtime.behavior", `FluxIQ did not build a Flow from the task's instruction (${build.failure?.code ?? "no proposal"})`, {
      details: { failure: build.failure, providerCalls: build.providerCalls, providerInvocation: build.providerInvocation },
    });
  }
  const review = await applyCreatedFlowProposal(input.control, { projectId, flowId, adaptationId: build.adaptationId, authorizationPin });
  const nodes = await readFlowNodes(input.control, { projectId, flowId }, bounds);
  const actionTypes = createdFlowActionTypes(nodes, flowId);
  const shape = createdFlowShape(nodes, actionTypes);
  // A node on a sensitive control asks the run for its value under a path;
  // each request is answered by exactly one declared secret, or the run fails
  // here, before it starts.
  const secretInputs = createdFlowSecretInputs({ scenarioId: request.task.scenarioId, secrets: input.secrets, workflow, nodes });
  // Exploration may have acted on the page; the Flow is judged on state it produced itself.
  await resetScenarioLab(input.scenarioOrigin, input.runToken, input.fetchLab);
  await input.prepareFlowPage();
  const run = await executeRecordedFlowRun(input.control, {
    projectId,
    flowId,
    facilityRunId,
    ...(input.projectDomainId === undefined ? {} : { domainId: input.projectDomainId }),
    actionTypes,
    // Each declared value once, under the path a node reads: Core persists a run's inputs, so any further copy is a copy on disk.
    inputs: { ...secretInputs, scenarioId: request.task.scenarioId, facilityRunId },
  }, bounds);
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
  const evidence: CreatedFlowLaneEvidence = Object.freeze({ request, build, review, flowId, shape, run, observation, extraction });
  await input.recordEvidence(evidence);
  assertFlowDidNotStopEarly(run);
  assertFlowFailure(workflow.expected.failure, run.failure);
  if (extraction) assertCreatedFlowDataset(extraction);
  else if (!oracleHeld) throw new RunnerFailure("runtime.behavior", "The created Flow ran, but the scenario's playback goal did not hold afterwards");
  return evidence;
}
