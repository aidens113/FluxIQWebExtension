// Where a live build's wall time goes, read from the Lab's per-step files
// (`lab-runs/<date>/run-*/steps/NNNN-*/meta.json`): live trials, site resets,
// exploration and model calls, plus the remainder. `cli.ts` runs it over the
// newest runs; the trace plan's P0 baseline is its output.
export { aggregateBuildTimes } from "./aggregate-build-times.js";
export { CATEGORY_RULES } from "./category-rules.js";
export { classifyStep } from "./classify-step.js";
export { findRecentRuns } from "./find-recent-runs.js";
export { IntervalSet } from "./interval-set.js";
export { measureBuildTime } from "./measure-build-time.js";
export { readStepTimings } from "./read-step-timings.js";
export { renderBuildTimeTable } from "./render-build-time-table.js";
export type { BuildCategory, BuildTimeTotals, CategoryRule, Interval, RunBuildTime, RunBuildTimeRow, RunFolder, StepClass, StepTiming } from "./types.js";
