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
 * `lanes` is which lanes the corpus runs, and it is what decides whether a
 * result runs at all. Each result runs on exactly one lane, the only lane that
 * can run it: an unarmed workflow on `recording`, where the Testing Lab drives
 * the fixture while the extension records, and a variant on `flow`, which is
 * the only lane that arms one. A result whose lane the corpus does not declare
 * is skipped with that reason, never counted as a pass.
 */
export type BenchCorpus = { id: string; description: string; lanes: readonly EvaluationLane[]; rows: readonly BenchCorpusRow[] };
