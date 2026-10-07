import { recordableActionTypes } from "../recordable-actions.js";
import type { ScenarioStep } from "../scenario.js";
import { pagedExtractExclusion } from "./paged-extract-exclusion.js";

/**
 * Why the Flow lane cannot run a workflow, or `undefined` when it can.
 *
 * The Flow lane builds its Flow from the recording of the workflow's own
 * script, so a script none of whose steps records an action can yield no Flow
 * on any product: Core proposes nothing, and the lane refuses an empty
 * proposal as `recording.contract` rather than pass a Flow that did nothing.
 * Which steps record an action is `recordableActionTypes`, keyed by every
 * `ScenarioStepOperation`, not a list of scenarios. Only the runner's own waits
 * and checks — `waitForState`, `checkpoint` and `waitForDownload` — record
 * nothing. An unpaged `extract` records a `web.dom.extract_list`, so W04 and
 * W08 reach the Flow lane and their extraction is judged there.
 *
 * A script with a paged `extract` step is excluded too
 * (`pagedExtractExclusion`): FluxIQ's read reads one page and a recording
 * cannot hold the Next page loop a Flow pages with, so a Flow built from the
 * recording would read the first page of a list the workflow reads whole.
 *
 * The bench skips such a workflow's Flow-lane results and the runner refuses a
 * `--flow` run of it as `fixture.invalid`, both with this reason, so the two
 * cannot disagree. A variant never changes the recording, so the workflow's
 * script decides for every variant of it.
 *
 * A script with no steps is a playback goal, which no recording produces, so
 * it is not judged here, as `validateWebScenario` does not judge its actions.
 */
export function flowLaneExclusion(script: readonly Pick<ScenarioStep, "id" | "operation" | "pagination">[]): string | undefined {
  if (script.length === 0) return undefined;
  if (recordableActionTypes(script).size === 0) {
    const operations = [...new Set(script.map((step) => step.operation))].join(", ");
    return `the Flow lane builds its Flow from the workflow's own recording, and no step of the workflow's recordingScript records an action (operations: ${operations}), so no recording of it can yield a Flow`;
  }
  const paged = pagedExtractExclusion(script);
  return paged === undefined ? undefined : `the Flow lane builds its Flow from the workflow's own recording, and its ${paged}`;
}
