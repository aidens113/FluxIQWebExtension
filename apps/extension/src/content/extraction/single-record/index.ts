// One record read as a one-row table, for the answers no repetition finds.
//
// Structure detection reads records by repetition (`../infer-list.ts`). These
// read the one record a page holds on its own: a label/value list such as a
// receipt (`key-value-record.ts`), and the record around a target with nothing
// of its template beside it, such as a product card in a message thread
// (`lone-record.ts`, which `lone-record-level.ts` decides for).

export { keyValueRecord } from "./key-value-record";
export { chooseLoneRecordLevel } from "./lone-record-level";
export { loneRecordAround } from "./lone-record";

export type { LoneRecordLevel } from "./lone-record-level";
