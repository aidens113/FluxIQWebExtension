import type { EvaluationLane } from "@fluxiq-web-extension/test-contracts";

/**
 * One corpus row: a scenario workflow run unarmed, with named variants, or
 * both. Each run the row names is a separate bench result sharing its id.
 */
export type BenchCorpusRow = {
  /** Corpus row id, such as `W05`. */
  id: string;
  scenarioId: string;
  /** A `workflows[]` entry; `null` for the manifest's primary workflow. */
  workflowId: string | null;
  /** Whether the row runs the workflow unarmed. Rows that exist only as a variant (W19 to W23) do not. */
  unarmed: boolean;
  /** Variants of that workflow the row arms, each its own result. */
  variantIds: readonly string[];
};

/**
 * A named set of corpus rows `lab bench --corpus <id>` runs.
 *
 * `lanes` is which lanes the corpus runs, and it decides on which lanes a
 * result runs and whether it runs at all. An unarmed workflow runs on every
 * declared lane: `recording`, where the Testing Lab drives the fixture while
 * the extension records, and `flow`, where FluxIQ runs a Flow built from that
 * recording. A variant runs on `flow` alone, the only lane that arms one. A
 * result that none of the declared lanes can run is skipped with that reason,
 * never counted as a pass (`expandCorpus`).
 */
export type BenchCorpus = { id: string; description: string; lanes: readonly EvaluationLane[]; rows: readonly BenchCorpusRow[] };
