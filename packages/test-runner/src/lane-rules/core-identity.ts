import type { ScenarioExpected, WebScenario } from "@fluxiq-web-extension/test-contracts";

/**
 * Whether an isolated run bootstraps a Core identity. Without one nothing pairs
 * the extension, so no Core action probe runs, nothing is recorded into Core,
 * and no Flow can be built.
 *
 * - A clone run always needs one: it imports and runs its Flow in that Core.
 * - A Flow-lane run always needs one: the lane builds its Flow from the run's
 *   own Core recording. It used to follow the recording lane's rule, so a
 *   workflow pinning no recording events, actions or playback goal ran on the
 *   Flow lane with no Core at all and passed on the recording's checks: six
 *   week1 bench results (W04, W06 and W08, unarmed and armed) never built a Flow.
 * - A recording-lane run needs one when the workflow it records pins recording
 *   events or actions, or the scenario has a playback goal.
 *
 * `recorded` is the expectation of the workflow that is recorded, which on the
 * Flow lane is the unarmed one.
 */
export function coreIdentityRequired(input: {
  clone: boolean;
  flowLane: boolean;
  scenario: Pick<WebScenario, "playbackGoal">;
  recorded: Pick<ScenarioExpected, "recordingEvents" | "actions">;
}): boolean {
  if (input.clone || input.flowLane) return true;
  return Boolean(input.recorded.recordingEvents?.length || input.recorded.actions?.length || input.scenario.playbackGoal);
}
