import { resolveScenarioWorkflow, type EvaluationLane, type ExpectedFailure, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { BenchCorpus, BenchCorpusRow } from "./corpus/index.js";

/** Why a resolved variant does not run: a variant is armed only by the Flow lane, and this corpus does not run it. */
export const VARIANT_NEEDS_FLOW_LANE = "variants are armed only by the Flow lane, which this corpus does not run; the recording lane always runs a workflow unarmed";
/** Why a resolved unarmed workflow does not run: it runs on the recording lane and the Flow lane, and the corpus runs neither. */
export const UNARMED_NEEDS_A_LANE = "an unarmed workflow runs on the recording lane and the Flow lane, and this corpus runs neither";

/**
 * The lanes a result can run on. A variant runs on the Flow lane alone, the
 * only lane that arms one. An unarmed workflow runs on both: the recording
 * lane, where the Testing Lab drives the fixture while the extension records
 * and FluxIQ executes at most a two-action Core probe, and the Flow lane, where
 * FluxIQ runs a Flow built from that recording, the only lane on which FluxIQ
 * executes the workflow at all. Planning an unarmed workflow on both is what
 * lets one week1 bench measure FluxIQ executing W01-W18 beside the recording
 * lane every earlier bench measured.
 */
export const lanesForResult = (variantId: string | null): readonly EvaluationLane[] => (variantId === null ? ["recording", "flow"] : ["flow"]);

/**
 * One bench result a corpus row names, on one lane: its workflow unarmed, or
 * one variant. An unarmed workflow is an entry on each lane the corpus runs.
 * `resolved` is whether `resolveScenarioWorkflow` finds the scenario,
 * workflow, and variant in the registry. `lane` is the lane the entry runs on.
 * `skipReason` is set exactly when the entry does not run: it did not resolve,
 * or the corpus runs none of the lanes that can run it.
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
 * than dropped without a word.
 */
function plannedLanes(corpus: BenchCorpus, variantId: string | null): Array<{ lane: EvaluationLane; laneSkip: string | undefined }> {
  const capable = lanesForResult(variantId);
  const declared = capable.filter((lane) => corpus.lanes.includes(lane));
  if (declared.length > 0) return declared.map((lane) => ({ lane, laneSkip: undefined }));
  return [{ lane: capable[0] ?? "flow", laneSkip: variantId === null ? UNARMED_NEEDS_A_LANE : VARIANT_NEEDS_FLOW_LANE }];
}

function planEntry(row: BenchCorpusRow, variantId: string | null, lane: EvaluationLane, laneSkip: string | undefined, manifests: readonly WebScenario[]): BenchPlanEntry {
  const identity = { corpusRowId: row.id, scenarioId: row.scenarioId, workflowId: row.workflowId, variantId, lane };
  const scenario = manifests.find((candidate) => candidate.id === row.scenarioId);
  if (!scenario) return { ...identity, resolved: false, skipReason: `unresolved: the registry has no scenario ${row.scenarioId}`, expectedFailure: null };
  try {
    const resolved = resolveScenarioWorkflow(scenario, { ...(row.workflowId === null ? {} : { workflowId: row.workflowId }), ...(variantId === null ? {} : { variantId }) });
    const expectedFailure = resolved.expected.failure ?? null;
    return { ...identity, resolved: true, ...(laneSkip === undefined ? {} : { skipReason: laneSkip }), expectedFailure };
  } catch (error) {
    return { ...identity, resolved: false, skipReason: `unresolved: ${error instanceof Error ? error.message : String(error)}`, expectedFailure: null };
  }
}
