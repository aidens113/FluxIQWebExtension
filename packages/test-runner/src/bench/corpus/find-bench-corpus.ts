import { RunnerFailure } from "../../failure.js";
import type { BenchCorpus } from "./bench-corpus.js";
import { smokeCorpus } from "./smoke.js";
import { week1Corpus } from "./week1.js";

/** Every corpus `lab bench --corpus` accepts. */
export const benchCorpora: readonly BenchCorpus[] = [week1Corpus, smokeCorpus];

export function findBenchCorpus(id: string): BenchCorpus {
  const corpus = benchCorpora.find((candidate) => candidate.id === id);
  if (!corpus) throw new RunnerFailure("fixture.invalid", `Unknown bench corpus: ${id}. Known corpora: ${benchCorpora.map((candidate) => candidate.id).join(", ")}`);
  return corpus;
}
