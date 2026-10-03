// A list read that outlives its document: where a continued read's counts start
// from the checkpoint it was handed (`carried-count.ts`,
// `carried-condition-counts.ts`), and the checkpoint a read hands on before it
// follows a control (`read-checkpoint.ts`). `../list-reader.ts` is the read; the
// checkpoint's shape and its reader are `shared/extraction-continuation.ts`.

export { carriedConditionCounts } from "./carried-condition-counts";
export { carriedCount } from "./carried-count";
export { readCheckpoint } from "./read-checkpoint";

export type { CarriedConditionCounts } from "./carried-condition-counts";
export type { CarriedCountName } from "./carried-count";
export type { ReadSoFar } from "./read-checkpoint";
