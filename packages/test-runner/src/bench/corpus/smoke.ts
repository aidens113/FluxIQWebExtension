import type { BenchCorpus, BenchCorpusRow } from "./bench-corpus.js";
import { week1Corpus } from "./week1.js";

const week1Row = (id: string): BenchCorpusRow => {
  const found = week1Corpus.rows.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`The week1 corpus has no row ${id}`);
  return found;
};

/**
 * Two fast Week 1 rows with no variants, both proven live on `isolated`:
 * basic-form (W01) and iframe-checkout (W28). Taken from `week1Corpus`, so
 * each row maps exactly as it does there.
 */
export const smokeCorpus: BenchCorpus = {
  id: "smoke",
  description: "Two fast Week 1 rows: basic-form (W01) and iframe-checkout (W28)",
  rows: [week1Row("W01"), week1Row("W28")],
};
