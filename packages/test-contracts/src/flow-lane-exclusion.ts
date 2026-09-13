import { recordableActionTypes } from "./recordable-actions.js";
import type { ScenarioStep } from "./scenario.js";

/**
 * Why the Flow lane cannot run a workflow, or `undefined` when it can.
 *
 * The Flow lane builds its Flow from the recording of the workflow's own
 * script, so a script none of whose steps records an action can yield no Flow
 * on any product: Core proposes nothing, and the lane refuses an empty
 * proposal as `recording.contract` rather than pass a Flow that did nothing.
 * Which steps record an action is `recordableActionTypes`, keyed by every
 * `ScenarioStepOperation`, not a list of scenarios. An `extract` without
 * `pagination` and a `checkpoint` only read the page, which is all W04 and W08
 * do; a Flow that extracts is authored, never proposed from a recording.
 *
 * The bench skips such a workflow's Flow-lane results and the runner refuses a
 * `--flow` run of it as `fixture.invalid`, both with this reason, so the two
 * cannot disagree. A variant never changes the recording, so the workflow's
 * script decides for every variant of it.
 *
 * A script with no steps is a playback goal, which no recording produces, so
 * it is not judged here, as `validateWebScenario` does not judge its actions.
 */
export function flowLaneExclusion(script: readonly Pick<ScenarioStep, "operation" | "pagination">[]): string | undefined {
  if (script.length === 0 || recordableActionTypes(script).size > 0) return undefined;
  const operations = [...new Set(script.map((step) => step.operation))].join(", ");
  return `the Flow lane builds its Flow from the workflow's own recording, and no step of the workflow's recordingScript records an action (operations: ${operations}), so no recording of it can yield a Flow`;
}
