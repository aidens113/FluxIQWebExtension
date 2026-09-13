import type { ExpectedFact, ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";

/**
 * The facts a run's final state is judged on, in order: the resolved workflow's
 * `finalState`, then the scenario's playback-goal success facts when the run is
 * the manifest's primary workflow and is expected to succeed.
 *
 * A negative run -- one whose resolved `expected.failure` is set, as a negative
 * variant's is, and which the bench scores by classification -- is not judged
 * on the goal: the goal describes the workflow succeeding, and the negative
 * run's own final state says it must not. identity-drift's `save-and-exit`
 * requires the save status to stay empty while its goal requires the save, so
 * W29 could never pass.
 */
export function finalStateFacts(scenario: Pick<WebScenario, "playbackGoal">, workflow: Pick<ResolvedScenarioWorkflow, "workflowId" | "expected">): ExpectedFact[] {
  const goalFacts = workflow.workflowId === undefined && workflow.expected.failure === undefined ? (scenario.playbackGoal?.successFacts ?? []) : [];
  return [...(workflow.expected.finalState ?? []), ...goalFacts];
}
