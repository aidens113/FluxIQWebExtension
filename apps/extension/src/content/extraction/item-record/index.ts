// An item of a list read as a record (`list-reader.ts`): the request's field
// readers, the record one item yields, the full-disclosure check on the items a
// read keeps, the key records are compared by, and what the answered records
// are short of. Split out of `list-reader.ts` on 2026-10-20, when the
// kept-item disclosure check took it past the 800-line budget.

export { fieldReaders, type FieldReaders } from "./field-readers";
export { readRecord, type ItemRead } from "./read-record";
export { assertDisclosed } from "./assert-disclosed";
export { contentKey } from "./content-key";
export { recordGaps } from "./record-gaps";
