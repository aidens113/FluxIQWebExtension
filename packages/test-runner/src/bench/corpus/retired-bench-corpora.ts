/**
 * Corpora `lab bench --corpus` once accepted and now refuses, each with why, so
 * an old command line or a saved campaign that names one is told what happened
 * rather than that the corpus is unknown.
 *
 * `week2` measured the adaptation drifts (identity-drift `renamed-redesign`,
 * product-catalog `text-variant`, data-table `column-reorder`, modal-flows
 * `banner-absent`, intermediate-state `unannounced`, member-directory
 * `restyled`) on the Flow lane alone. That lane ran a Flow built from the run's
 * own recording, which t519 retired, so from t553 every result it planned was
 * skipped and the corpus ran nothing (t559 retired it).
 */
export const RETIRED_BENCH_CORPORA: Readonly<Record<string, string>> = {
  week2: "measured adaptation drifts on the Flow lane alone, which ran a Flow built from the run's own recording; recording-only Flow creation is retired, so it could run nothing. A drift is adapted by a live run that builds its Flow from written instructions: pnpm lab run <scenario> --live-llm --llm-task create-flow --instruction-task <task> --replays 1",
};
