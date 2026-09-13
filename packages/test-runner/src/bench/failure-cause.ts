import type { BenchRunRecord } from "./report-store.js";

/**
 * One cause of failure and how many of a bench's runs died of it: the test-rig
 * category and the one-line message the run recorded, or an empty message when
 * the run recorded none.
 */
export type BenchFailureCause = { runs: number; category: string; message: string };

/**
 * Every distinct cause among a bench's failed runs, most runs first.
 *
 * This exists because a bench can be destroyed by one fault and still report
 * nothing about it. Four runs once died in under a second on the same missing
 * FluxIQ Core module, and the bench published `failureCategory: unknown` four
 * times with no message: the fault was uniform, obvious, and invisible. When
 * one cause accounts for every run of a bench, that is the single most useful
 * sentence the report can say, so it is computed once here and used both by
 * the outcome the terminal prints and by the top of `report.md`.
 *
 * A skipped run is not a failure and never appears. A passing run never does
 * either, even one that recorded an `error` event and recovered.
 */
export function benchFailureCauses(runs: readonly BenchRunRecord[]): BenchFailureCause[] {
  const grouped = new Map<string, BenchFailureCause>();
  for (const run of runs) {
    if (run.status !== "evaluated" || run.verdict === undefined || run.verdict === "passed") continue;
    const cause: BenchFailureCause = { runs: 0, category: run.failureCategory ?? "unknown", message: run.failureCause ?? "" };
    const key = `${cause.category}\u0000${cause.message}`;
    const existing = grouped.get(key) ?? cause;
    existing.runs += 1;
    grouped.set(key, existing);
  }
  return [...grouped.values()].sort((left, right) => right.runs - left.runs);
}

/** One cause as a single line: how many runs, the category, and the message. */
export function describeBenchFailureCause(cause: BenchFailureCause): string {
  return `${cause.runs} run${cause.runs === 1 ? "" : "s"} — ${cause.category}: ${cause.message === "" ? "no cause recorded" : cause.message}`;
}
