import { RunnerFailure } from "../../failure.js";
import type { BenchCorpus } from "./bench-corpus.js";
import { RETIRED_BENCH_CORPORA } from "./retired-bench-corpora.js";
import { smokeCorpus } from "./smoke.js";
import { week1Corpus } from "./week1.js";

/** Every corpus `lab bench --corpus` accepts. */
export const benchCorpora: readonly BenchCorpus[] = [week1Corpus, smokeCorpus];

/** The corpus named `id`. A retired corpus is refused with why (`RETIRED_BENCH_CORPORA`), and an unknown one names the known. */
export function findBenchCorpus(id: string): BenchCorpus {
  const corpus = benchCorpora.find((candidate) => candidate.id === id);
  if (corpus) return corpus;
  const retired = Object.hasOwn(RETIRED_BENCH_CORPORA, id) ? RETIRED_BENCH_CORPORA[id] : undefined;
  if (retired !== undefined) throw new RunnerFailure("fixture.invalid", `Bench corpus ${id} is retired: it ${retired}. Known corpora: ${benchCorpora.map((candidate) => candidate.id).join(", ")}`, { details: { retiredCorpus: id } });
  throw new RunnerFailure("fixture.invalid", `Unknown bench corpus: ${id}. Known corpora: ${benchCorpora.map((candidate) => candidate.id).join(", ")}`);
}
