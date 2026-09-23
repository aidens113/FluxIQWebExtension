// A finished run read into one summary row: its bundle of records, what the
// provider reported spending, the created Flow's shape, and the judgement the
// task asks for (its dataset, its playback goal, or what a repair did).

export { EMPTY_BUNDLE, readRunBundle } from "./bundle.mjs";
export { summarizeTask } from "./summarize-task.mjs";
export * from "./rung-attribution.mjs";
