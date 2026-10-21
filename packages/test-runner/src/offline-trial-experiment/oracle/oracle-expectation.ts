// The task's own oracle as Scenario Lab builds it: the live task's expected
// dataset, which is the `expected.extracted` entry of the step its
// `expectedDatasetId` names, on the workflow and variant the task resolves to
// (`loadCreatedFlowRequest`, the resolution a Lab run judges by).

import { resolveScenarioWorkflow, type ExpectedExtraction, type ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { loadCreatedFlowRequest } from "../../flow-lane/index.js";
import { loadScenarioManifest } from "../../scenarios.js";

export type OracleTask = Readonly<{ repositoryRoot: string; scenarioLabDist: string; scenarioId: string; taskId: string; scenarioOrigin: string }>;

export type OracleExpectation = Readonly<{ workflow: ResolvedScenarioWorkflow; stepId: string; entry: ExpectedExtraction }>;

export async function loadOracleExpectation(task: OracleTask): Promise<OracleExpectation> {
  const request = await loadCreatedFlowRequest({ repositoryRoot: task.repositoryRoot, scenarioLabDist: task.scenarioLabDist, scenarioId: task.scenarioId, taskId: task.taskId });
  if (request.judgement.judgeBy !== "expected-dataset") throw new RunnerFailure("fixture.invalid", `Task ${task.taskId} is not judged by an expected dataset`);
  const scenario = await loadScenarioManifest(task.repositoryRoot, task.scenarioId, task.scenarioLabDist);
  const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  const stepId = request.judgement.stepId;
  const entry = (workflow.expected.extracted ?? []).find((candidate) => candidate.step === stepId);
  if (!entry) throw new RunnerFailure("fixture.invalid", `Task ${task.taskId}'s workflow expects nothing of step ${stepId}`);
  return Object.freeze({ workflow, stepId, entry });
}
