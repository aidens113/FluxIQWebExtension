import { resolveScenarioWorkflow, type EvaluationLane, type ExpectedFailure, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { BenchCorpus, BenchCorpusRow } from "./corpus/index.js";

/** Why a resolved variant does not run: a variant is armed only by the Flow lane, and this corpus does not run it. */
export const VARIANT_NEEDS_FLOW_LANE = "variants are armed only by the Flow lane, which this corpus does not run; the recording lane always runs a workflow unarmed";
/** Why a resolved unarmed workflow does not run: the corpus runs no recording lane. */
export const UNARMED_NEEDS_RECORDING_LANE = "an unarmed workflow runs on the recording lane, which this corpus does not run";

/**
 * The lane a result can run on. An unarmed workflow runs on the recording
 * lane; a variant runs on the Flow lane, the only lane that arms one. This is
 * a property of the result, not a choice: it is why a corpus that runs one
 * lane cannot cover the other's results.
 */
export const laneForResult = (variantId: string | null): EvaluationLane => (variantId === null ? "recording" : "flow");

/**
 * One bench result a corpus row names: its workflow unarmed, or one variant.
 * `resolved` is whether `resolveScenarioWorkflow` finds the scenario,
 * workflow, and variant in the registry. `lane` is the lane that would run it.
 * `skipReason` is set exactly when the result does not run: it did not
 * resolve, or the corpus does not run its lane.
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

/** Every result the corpus names, in row order: a row's unarmed workflow first, then its variants. */
export function expandCorpus(corpus: BenchCorpus, manifests: readonly WebScenario[]): BenchPlanEntry[] {
  return corpus.rows.flatMap((row) => [...(row.unarmed ? [null] : []), ...row.variantIds].map((variantId) => planEntry(corpus, row, variantId, manifests)));
}

function planEntry(corpus: BenchCorpus, row: BenchCorpusRow, variantId: string | null, manifests: readonly WebScenario[]): BenchPlanEntry {
  const lane = laneForResult(variantId);
  const identity = { corpusRowId: row.id, scenarioId: row.scenarioId, workflowId: row.workflowId, variantId, lane };
  const scenario = manifests.find((candidate) => candidate.id === row.scenarioId);
  if (!scenario) return { ...identity, resolved: false, skipReason: `unresolved: the registry has no scenario ${row.scenarioId}`, expectedFailure: null };
  try {
    const resolved = resolveScenarioWorkflow(scenario, { ...(row.workflowId === null ? {} : { workflowId: row.workflowId }), ...(variantId === null ? {} : { variantId }) });
    const expectedFailure = resolved.expected.failure ?? null;
    const missingLane = corpus.lanes.includes(lane) ? undefined : lane === "flow" ? VARIANT_NEEDS_FLOW_LANE : UNARMED_NEEDS_RECORDING_LANE;
    return { ...identity, resolved: true, ...(missingLane === undefined ? {} : { skipReason: missingLane }), expectedFailure };
  } catch (error) {
    return { ...identity, resolved: false, skipReason: `unresolved: ${error instanceof Error ? error.message : String(error)}`, expectedFailure: null };
  }
}
