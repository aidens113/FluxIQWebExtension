import { pagedExtractExclusion, resolveScenarioWorkflow, type EvaluationLane, type ExpectedFailure, type ScenarioStep, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { BenchCorpus, BenchCorpusRow } from "./corpus/index.js";

/** Why a resolved unarmed workflow does not run: it runs on the recording lane, and the corpus runs neither that nor the retired Flow lane. */
export const UNARMED_NEEDS_A_LANE = "an unarmed workflow runs on the recording lane and the Flow lane, and this corpus runs neither";
/**
 * Why a resolved Flow-lane result does not run. The Flow lane ran a Flow built
 * from the run's own recording, and t519 retired recording-only Flow creation:
 * the runner refuses it (`flow-lane/recording-only/`), so a planned run could
 * only ever be refused. The result is still planned and listed with this
 * reason, so a corpus that names it says what happened to it.
 */
export const FLOW_LANE_RETIRED = "the Flow lane ran a Flow built from the run's own recording, and recording-only Flow creation is retired; a Flow is built from written instructions by a live run: pnpm lab run <scenario> --live-llm --llm-task create-flow --instruction-task <task>";

/**
 * The lanes a result can run on. A variant runs on the Flow lane alone, the
 * only lane that armed one. An unarmed workflow runs on both: the recording
 * lane, where the Testing Lab drives the fixture while the extension records
 * and FluxIQ executes at most a two-action Core probe, and the Flow lane, where
 * FluxIQ ran a Flow built from that recording. The Flow lane is retired, so
 * every result planned on it is skipped (`FLOW_LANE_RETIRED`) and only the
 * recording lane runs.
 */
export const lanesForResult = (variantId: string | null): readonly EvaluationLane[] => (variantId === null ? ["recording", "flow"] : ["flow"]);

/**
 * One bench result a corpus row names, on one lane: its workflow unarmed, or
 * one variant. An unarmed workflow is an entry on each lane the corpus runs.
 * `resolved` is whether `resolveScenarioWorkflow` finds the scenario,
 * workflow, and variant in the registry. `lane` is the lane the entry runs on.
 * `skipReason` is set exactly when the entry does not run: it did not resolve,
 * the corpus runs none of the lanes that can run it, or its lane cannot run its
 * workflow's script (`laneExclusion`).
 */
export type BenchPlanEntry = {
  corpusRowId: string;
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  resolved: boolean;
  lane: EvaluationLane;
  skipReason?: string;
  /** The resolved `expected.failure`: what a negative run must be classified as. */
  expectedFailure: ExpectedFailure | null;
};

/** Every result the corpus names, in row order: a row's unarmed workflow first, on each of its lanes, then its variants. */
export function expandCorpus(corpus: BenchCorpus, manifests: readonly WebScenario[]): BenchPlanEntry[] {
  return corpus.rows.flatMap((row) => [...(row.unarmed ? [null] : []), ...row.variantIds].flatMap((variantId) =>
    plannedLanes(corpus, variantId).map(({ lane, laneSkip }) => planEntry(row, variantId, lane, laneSkip, manifests))));
}

/**
 * Each lane the corpus runs that can run a result, in `lanesForResult` order.
 * A result none of the corpus's lanes can run is still planned, once, on the
 * first lane that could, so it is listed as skipped with its reason rather
 * than dropped without a word: a variant's is the Flow lane, which is retired.
 */
function plannedLanes(corpus: BenchCorpus, variantId: string | null): Array<{ lane: EvaluationLane; laneSkip: string | undefined }> {
  const capable = lanesForResult(variantId);
  const declared = capable.filter((lane) => corpus.lanes.includes(lane));
  if (declared.length > 0) return declared.map((lane) => ({ lane, laneSkip: undefined }));
  return [{ lane: capable[0] ?? "flow", laneSkip: variantId === null ? UNARMED_NEEDS_A_LANE : undefined }];
}

/**
 * A resolved entry on the retired Flow lane is skipped as retired, and one
 * whose recording lane cannot run its workflow's script is skipped with the
 * reason `laneExclusion` gives, rather than planned to fail every repeat
 * whatever FluxIQ did.
 */
function planEntry(row: BenchCorpusRow, variantId: string | null, lane: EvaluationLane, laneSkip: string | undefined, manifests: readonly WebScenario[]): BenchPlanEntry {
  const identity = { corpusRowId: row.id, scenarioId: row.scenarioId, workflowId: row.workflowId, variantId, lane };
  const scenario = manifests.find((candidate) => candidate.id === row.scenarioId);
  if (!scenario) return { ...identity, resolved: false, skipReason: `unresolved: the registry has no scenario ${row.scenarioId}`, expectedFailure: null };
  try {
    const resolved = resolveScenarioWorkflow(scenario, { ...(row.workflowId === null ? {} : { workflowId: row.workflowId }), ...(variantId === null ? {} : { variantId }) });
    const expectedFailure = resolved.expected.failure ?? null;
    const skipReason = lane === "flow" ? FLOW_LANE_RETIRED : laneSkip ?? recordingLaneExclusion(resolved.recordingScript);
    return { ...identity, resolved: true, ...(skipReason === undefined ? {} : { skipReason }), expectedFailure };
  } catch (error) {
    return { ...identity, resolved: false, skipReason: `unresolved: ${error instanceof Error ? error.message : String(error)}`, expectedFailure: null };
  }
}

/**
 * Why the recording lane cannot run a workflow's script, or `undefined` when
 * it can: a paged extract step (`pagedExtractExclusion`). FluxIQ's read reads
 * one page and no recording can hold the Next page loop, so the step's
 * extraction intent refuses it (`extract-intent.ts`) rather than record and
 * measure a one-page read; planning the run would only plan that refusal.
 */
function recordingLaneExclusion(script: readonly ScenarioStep[]): string | undefined {
  const paged = pagedExtractExclusion(script);
  return paged === undefined ? undefined : `the recording lane reads each extract step through FluxIQ's own read, and its ${paged}`;
}
