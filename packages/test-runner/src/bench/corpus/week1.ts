import type { BenchCorpus, BenchCorpusRow } from "./bench-corpus.js";

const row = (id: string, scenarioId: string, workflowId: string | null, variantIds: readonly string[] = []): BenchCorpusRow => ({ id, scenarioId, workflowId, unarmed: true, variantIds });
const variantOnly = (id: string, scenarioId: string, workflowId: string | null, variantIds: readonly string[]): BenchCorpusRow => ({ id, scenarioId, workflowId, unarmed: false, variantIds });

/**
 * FluxBench Week 1: W01 to W29 as the plan's corpus table lists them
 * (`docs/working/mvp-week1-web-automation-reliability-plan.md`, "FluxBench
 * Week 1 Corpus"). Variant ids are the table's, with two readings: W23's
 * `wrapped` + `aria-variant` is the fixture's single `wrapped-aria` variant,
 * and W27's surfaces are named for the table's "disabled, detached, blocked
 * URL". W19 to W23 and W29 are variants only; their rows run no unarmed
 * workflow. W29 is identity-drift's `save-and-exit`: a different action in
 * Save's slot, which the resolver must refuse as `target_not_found`.
 *
 * Both lanes run. Every unarmed workflow runs on both, and every variant on the
 * Flow lane, the only lane that arms one: 67 runnable results per repeat, 23 on
 * the recording lane and 44 on the Flow lane (23 unarmed, 21 variants). The
 * Flow lane is the only lane on which FluxIQ executes a workflow, so it is what
 * makes W01-W18 a measurement of FluxIQ and gives drift recovery, fuzzy
 * recovery and failure classification a population; the recording lane keeps
 * the measurement every earlier bench made. Whether a Flow-lane result passes
 * is a measurement, not an assumption.
 */
export const week1Corpus: BenchCorpus = {
  id: "week1",
  description: "FluxBench Week 1: W01 to W29",
  lanes: ["recording", "flow"],
  rows: [
    row("W01", "basic-form", null),
    row("W02", "keyboard-forms", null),
    row("W03", "keyboard-forms", "combobox"),
    row("W04", "product-catalog", null, ["text-variant"]),
    row("W05", "product-catalog", "paginated-extraction", ["short-catalog"]),
    row("W06", "product-catalog", "search", ["no-results"]),
    row("W07", "product-catalog", "in-stock-only"),
    row("W08", "data-table", null, ["column-reorder"]),
    row("W09", "data-table", "sort-by-price"),
    row("W10", "navigation", null, ["broken-link"]),
    row("W11", "infinite-feed", null, ["end-early"]),
    row("W12", "modal-flows", null),
    row("W13", "modal-flows", "consent-then-click", ["banner-absent"]),
    row("W14", "modal-flows", "interstitial", ["armed"]),
    row("W15", "multi-tab", null, ["popup-blocked"]),
    row("W16", "file-transfer", null),
    row("W17", "file-transfer", "upload"),
    row("W18", "auth-gate", null),
    variantOnly("W19", "auth-gate", null, ["expired"]),
    variantOnly("W20", "identity-drift", null, ["selector-only"]),
    variantOnly("W21", "identity-drift", null, ["text-only"]),
    variantOnly("W22", "identity-drift", null, ["moved"]),
    variantOnly("W23", "identity-drift", null, ["wrapped-aria"]),
    row("W24", "intermediate-state", null, ["unannounced"]),
    row("W25", "delayed-ui", null, ["too-slow"]),
    row("W26", "ambiguous-targets", null, ["no-context"]),
    row("W27", "failure-surfaces", null, ["disabled", "detached", "blocked-url"]),
    row("W28", "iframe-checkout", null),
    variantOnly("W29", "identity-drift", null, ["save-and-exit"]),
  ],
};
