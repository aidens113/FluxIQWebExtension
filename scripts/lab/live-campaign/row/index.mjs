// A finished run read into one summary row: its bundle of records, what the
// provider reported spending, the created Flow's shape, what the build's own
// steps declared they would lastingly do and who allowed it, and the judgement
// the task asks for (its dataset, its playback goal, or what a repair did).

export { EMPTY_BUNDLE, readRunBundle } from "./bundle.mjs";
export { consequenceSummary } from "./consequences.mjs";
export { summarizeTask } from "./summarize-task.mjs";
export * from "./rung-attribution.mjs";
