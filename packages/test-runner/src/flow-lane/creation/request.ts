// What a created-Flow run builds and how it is judged, decided once, before a
// topology, a browser or a grant exists. Everything a run later reads about
// its task comes from here, so a task the scenario cannot judge is refused
// while refusing is still free.

import { createHash } from "node:crypto";
import { resolveScenarioWorkflow, type ResolvedScenarioWorkflow, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { loadLiveInstructionTasks } from "./instruction-catalog.js";
import { selectLiveInstructionTask, type LiveInstructionTask } from "./instruction-task.js";

/**
 * - `playback-goal`: the scenario's playback goal, `goalId`, judged on the
 *   primary workflow's final-state facts as the recorded Flow lane judges
 *   them (`lane-rules/final-state-facts.ts`).
 * - `expected-dataset`: the `expected.extracted` entry whose step is
 *   `stepId`, an `extract` step of the selected workflow at `stepIndex`.
 */
export type CreatedFlowJudgement =
  | Readonly<{ judgeBy: "playback-goal"; goalId: string }>
  | Readonly<{ judgeBy: "expected-dataset"; stepId: string; stepIndex: number }>;

/**
 * `workflowId` is the workflow whose expectations judge the run: absent for
 * the primary one, or the `workflows[]` entry whose script holds the expected
 * dataset's step. `variantId` is the task's own variant, which the run arms
 * once the unarmed page has loaded, before the exploration and again before
 * the run, so the exploration and the created Flow both meet the rendering the
 * task names.
 */
export type CreatedFlowRequest = Readonly<{
  task: LiveInstructionTask;
  workflowId: string | undefined;
  variantId: string | undefined;
  judgement: CreatedFlowJudgement;
}>;

/**
 * Reads the catalog and the scenario from the run's scenario lab build and
 * resolves the task the command names, or the scenario's first.
 */
export async function loadCreatedFlowRequest(input: {
  repositoryRoot: string;
  scenarioLabDist: string;
  scenarioId: string;
  taskId?: string;
  workflowId?: string;
  variantId?: string;
}): Promise<CreatedFlowRequest> {
  const scenario = await loadScenarioManifest(input.repositoryRoot, input.scenarioId, input.scenarioLabDist);
  const task = selectLiveInstructionTask(await loadLiveInstructionTasks(input.scenarioLabDist), scenario.id, input.taskId);
  return resolveCreatedFlowRequest(scenario, task, {
    ...(input.workflowId === undefined ? {} : { workflowId: input.workflowId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
  });
}

/**
 * Resolves `task` against its scenario. Every refusal is `fixture.invalid`: a
 * task naming a variant its workflow does not have, a goal the scenario does
 * not declare, a dataset step no workflow extracts, or an expectation with
 * nothing to compare, is a defect in the catalog and never a product result.
 *
 * `selection` is what the command line typed. A `--variant` must be the
 * task's own variant: the task's judgement was written for that rendering, so
 * a different one is refused rather than silently preferred.
 */
export function resolveCreatedFlowRequest(scenario: WebScenario, task: LiveInstructionTask, selection: { workflowId?: string; variantId?: string } = {}): CreatedFlowRequest {
  if (task.scenarioId !== scenario.id) throw refusal(task, `belongs to scenario ${task.scenarioId}, not ${scenario.id}`);
  if (selection.variantId !== undefined && selection.variantId !== task.variantId) {
    throw refusal(task, task.variantId === undefined ? `names no variant, so --variant ${selection.variantId} does not apply` : `names variant ${task.variantId}, not --variant ${selection.variantId}`);
  }
  if (task.judgeBy === "playback-goal") {
    if (selection.workflowId !== undefined) throw refusal(task, "is judged on the scenario's primary workflow, so --workflow does not apply");
    const goal = scenario.playbackGoal;
    if (!goal || goal.successFacts.length === 0) throw refusal(task, "is judged by a playback goal the scenario does not declare");
    assertPositive(task, resolve(scenario, task, undefined));
    return Object.freeze({ task, workflowId: undefined, variantId: task.variantId, judgement: Object.freeze({ judgeBy: "playback-goal", goalId: goal.id }) });
  }
  const stepId = task.expectedDatasetId;
  if (stepId === undefined) throw refusal(task, "names no expected dataset");
  const owners = workflowsOf(scenario).filter((workflow) => workflow.recordingScript.some((step) => step.operation === "extract" && step.id === stepId));
  const selected = selection.workflowId === undefined ? owners : owners.filter((workflow) => workflow.id === selection.workflowId);
  if (selected.length !== 1) {
    throw refusal(task, selected.length === 0
      ? `names expected dataset ${stepId}, which no ${selection.workflowId === undefined ? "" : "selected "}workflow of the scenario extracts`
      : `names expected dataset ${stepId}, which ${selected.length} workflows extract`);
  }
  const owner = selected[0]!;
  const workflow = resolve(scenario, task, owner.id);
  assertPositive(task, workflow);
  const entry = workflow.expected.extracted?.find((candidate) => candidate.step === stepId);
  if (!entry) throw refusal(task, `names expected dataset ${stepId}, which its workflow expects nothing of`);
  if (entry.count === undefined && entry.records === undefined) throw refusal(task, `names expected dataset ${stepId}, whose expectation declares neither records nor a count to compare`);
  const stepIndex = workflow.recordingScript.findIndex((step) => step.id === stepId);
  return Object.freeze({ task, workflowId: owner.id, variantId: task.variantId, judgement: Object.freeze({ judgeBy: "expected-dataset", stepId, stepIndex }) });
}

/**
 * The request as a dry run prints it: identifiers, closed names, and the
 * instruction's size and digest. The instruction itself is fixture text, but
 * it is what the model is sent, so it is left to the catalog rather than
 * copied into a terminal or a bundle.
 */
export function describeCreatedFlowRequest(request: CreatedFlowRequest) {
  const { task, judgement } = request;
  return {
    taskId: task.id,
    scenarioId: task.scenarioId,
    kind: task.kind,
    workflowId: request.workflowId ?? null,
    variantId: request.variantId ?? null,
    judgement: judgement.judgeBy === "playback-goal"
      ? { judgeBy: judgement.judgeBy, goalId: judgement.goalId }
      : { judgeBy: judgement.judgeBy, stepId: judgement.stepId, stepIndex: judgement.stepIndex },
    instruction: { characters: task.instruction.length, sha256: createHash("sha256").update(task.instruction, "utf8").digest("hex") },
  };
}

type WorkflowEntry = { id: string | undefined; recordingScript: WebScenario["recordingScript"] };

/** The primary workflow first, then every `workflows[]` entry. */
function workflowsOf(scenario: WebScenario): WorkflowEntry[] {
  return [{ id: undefined, recordingScript: scenario.recordingScript }, ...(scenario.workflows ?? []).map((workflow) => ({ id: workflow.id, recordingScript: workflow.recordingScript }))];
}

function resolve(scenario: WebScenario, task: LiveInstructionTask, workflowId: string | undefined): ResolvedScenarioWorkflow {
  try {
    return resolveScenarioWorkflow(scenario, { ...(workflowId === undefined ? {} : { workflowId }), ...(task.variantId === undefined ? {} : { variantId: task.variantId }) });
  } catch (cause) {
    throw refusal(task, `names variant ${task.variantId ?? "(none)"}, which its workflow does not declare`, cause);
  }
}

/** Every task is judged on succeeding; a workflow that expects a failure has nothing a created Flow could achieve. */
function assertPositive(task: LiveInstructionTask, workflow: ResolvedScenarioWorkflow): void {
  if (workflow.expected.failure !== undefined) throw refusal(task, "resolves to a workflow that expects the run to fail");
}

function refusal(task: LiveInstructionTask, problem: string, cause?: unknown): RunnerFailure {
  return new RunnerFailure("fixture.invalid", `Live instruction task ${task.id} ${problem}`, { ...(cause === undefined ? {} : { cause }), details: { taskId: task.id } });
}
