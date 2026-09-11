import { resolveScenarioWorkflow, type ExpectedFailure, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { BenchCorpus, BenchCorpusRow } from "./corpus/index.js";

/** Why a resolved variant does not run: arming belongs to the Flow lane. */
export const VARIANT_NEEDS_FLOW_LANE = "variants are armed only by the Flow lane (Wave 2); the recording lane always runs a workflow unarmed";

/**
 * One bench result a corpus row names: its workflow unarmed, or one variant.
 * `resolved` is whether `resolveScenarioWorkflow` finds the scenario,
 * workflow, and variant in the registry. `skipReason` is set exactly when the
 * result does not run on the recording lane.
 */
export type BenchPlanEntry = {
  corpusRowId: string;
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  resolved: boolean;
  skipReason?: string;
  /** The resolved `expected.failure`: what a negative run must be classified as. */
  expectedFailure: ExpectedFailure | null;
};

/** Every result the corpus names, in row order: a row's unarmed workflow first, then its variants. */
export function expandCorpus(corpus: BenchCorpus, manifests: readonly WebScenario[]): BenchPlanEntry[] {
  return corpus.rows.flatMap((row) => [...(row.unarmed ? [null] : []), ...row.variantIds].map((variantId) => planEntry(row, variantId, manifests)));
}

function planEntry(row: BenchCorpusRow, variantId: string | null, manifests: readonly WebScenario[]): BenchPlanEntry {
  const identity = { corpusRowId: row.id, scenarioId: row.scenarioId, workflowId: row.workflowId, variantId };
  const scenario = manifests.find((candidate) => candidate.id === row.scenarioId);
  if (!scenario) return { ...identity, resolved: false, skipReason: `unresolved: the registry has no scenario ${row.scenarioId}`, expectedFailure: null };
  try {
    const resolved = resolveScenarioWorkflow(scenario, { ...(row.workflowId === null ? {} : { workflowId: row.workflowId }), ...(variantId === null ? {} : { variantId }) });
    const expectedFailure = resolved.expected.failure ?? null;
    return variantId === null ? { ...identity, resolved: true, expectedFailure } : { ...identity, resolved: true, skipReason: VARIANT_NEEDS_FLOW_LANE, expectedFailure };
  } catch (error) {
    return { ...identity, resolved: false, skipReason: `unresolved: ${error instanceof Error ? error.message : String(error)}`, expectedFailure: null };
  }
}
