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

/** A named set of corpus rows `lab bench --corpus <id>` runs. */
export type BenchCorpus = { id: string; description: string; rows: readonly BenchCorpusRow[] };
