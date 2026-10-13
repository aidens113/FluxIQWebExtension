import type { ExpectedFact, ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { finalStateFacts } from "../lane-rules/index.js";

/**
 * The final-state facts a replay checks after the Flow ran, or `null` when it checks none.
 *
 * A task judged by its playback goal is checked against its final state. A task judged by its
 * expected dataset is checked against its final state too when the workflow declares one, as the
 * created-Flow lane judges it (`declaresFinalState`, `../flow-lane/creation/lane.ts`): a Flow can
 * store the right rows and still act on more items than the instruction asked (lane D round 14,
 * `run-mv6bg8sv-99895ba1`, whose first trial confirmed every request), and a replay that compared
 * only the rows would pass it.
 */
export function replayFinalStateFacts(
  judgeBy: "expected-dataset" | string,
  scenario: Pick<WebScenario, "playbackGoal">,
  workflow: Pick<ResolvedScenarioWorkflow, "workflowId" | "expected">,
): ExpectedFact[] | null {
  if (judgeBy !== "expected-dataset") return finalStateFacts(scenario, workflow);
  return (workflow.expected.finalState?.length ?? 0) > 0 ? finalStateFacts(scenario, workflow) : null;
}
