import type { BenchCorpus, BenchCorpusRow } from "./bench-corpus.js";

const row = (id: string, scenarioId: string, workflowId: string | null, variantIds: readonly string[]): BenchCorpusRow => ({ id, scenarioId, workflowId, unarmed: true, variantIds });
const variantOnly = (id: string, scenarioId: string, workflowId: string | null, variantIds: readonly string[]): BenchCorpusRow => ({ id, scenarioId, workflowId, unarmed: false, variantIds });

/**
 * FluxBench Week 2: the drifts the adaptation loop exists for, measured on the
 * Flow lane alone, the only lane on which FluxIQ runs a Flow and Core can
 * create, validate, persist or reuse an adaptation. Row ids are `A01`-`A06`
 * (A for adaptation), because the report contract takes ids of capitals then
 * digits. Rows follow the Phase 2.9
 * scoping (`mvp-week2-automation-loop-plan/reports/w2-scope-repair-reuse.md`,
 * D2.9c) and the Week 2 exit plan:
 *
 * - A01 is the exit chain's drift, identity-drift's `renamed-redesign`, with
 *   its unarmed baseline beside it.
 * - A02 and A03 are Week 1's W04 and W08 extraction drifts, which X6
 *   repairs through the same loop.
 * - A04 and A05 are W13 and W24, classified by Phase 2.4.
 * - A06 is member-directory's `restyled`, where the plan measures what each
 *   validation re-run and resume costs in captures on a large page (E57).
 *
 * The item-selector drift D2.9d plans has no fixture variant yet, so it has no
 * row; adding the variant and its row together is what keeps this corpus fully
 * resolvable. A provider-free bench of this corpus measures the deterministic
 * ladder and Core's stored adaptations as they stand -- `llm` is disabled, so
 * no model can write a repair and the reuse aggregate counts only adaptations
 * a Flow already carried.
 */
export const week2Corpus: BenchCorpus = {
  id: "week2",
  description: "FluxBench Week 2: adaptation drifts on the Flow lane",
  lanes: ["flow"],
  rows: [
    row("A01", "identity-drift", null, ["renamed-redesign"]),
    variantOnly("A02", "product-catalog", null, ["text-variant"]),
    variantOnly("A03", "data-table", null, ["column-reorder"]),
    variantOnly("A04", "modal-flows", "consent-then-click", ["banner-absent"]),
    variantOnly("A05", "intermediate-state", null, ["unannounced"]),
    row("A06", "member-directory", null, ["restyled"]),
  ],
};
