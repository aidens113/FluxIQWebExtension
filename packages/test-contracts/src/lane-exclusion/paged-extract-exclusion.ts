import type { ScenarioStep } from "../scenario.js";

/**
 * Why a recording of `script` cannot stand for its paged read, or `undefined`
 * when no `extract` step pages.
 *
 * FluxIQ's list read reads one page (read-list redesign, stage S4). A Flow
 * goes through pages with a read, a Next page step and a repeat while Next
 * moves on, and a recording cannot produce that loop yet: the recorded
 * extraction definition is one read, and the Lab's `extract` step is one
 * step. So a step that declares `pagination` can no longer be recorded as
 * what it is. Recording it anyway stores a one-page read where the workflow
 * reads every page, which is the mis-recording this check exists to refuse:
 *
 * - the recording lane does not run such a workflow, and its extraction intent
 *   refuses the step rather than send a one-page definition
 *   (`packages/test-runner/src/scenario-steps/extract-intent.ts`);
 * - the Flow lane, which builds its Flow from that recording, does not run it
 *   either (`flowLaneExclusion`).
 *
 * The created-Flow lane is not affected: there the model builds the loop from
 * the task's words, and the step's `pagination` stays as the reference
 * reader's data (`extract-records.ts`) and the oracle's description of the
 * list.
 *
 * Step ids are fixture vocabulary, never page content, so the reason names
 * them.
 */
export function pagedExtractExclusion(script: readonly Pick<ScenarioStep, "id" | "operation" | "pagination">[]): string | undefined {
  const paged = script.filter((step) => step.operation === "extract" && step.pagination !== undefined).map((step) => step.id);
  if (paged.length === 0) return undefined;
  const steps = paged.length === 1 ? `extract step ${paged[0]} pages` : `extract steps ${paged.join(", ")} page`;
  return `${steps} through its list, and FluxIQ's read reads one page: a Flow pages with a read, a Next page step and a repeat, which no recording can produce yet, so a recording would store a one-page read in place of the paged one`;
}
