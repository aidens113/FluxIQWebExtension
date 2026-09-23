// Resolving an extraction node's list: the `extractList` slot a model wrote,
// the detected columns it keeps, and the conditions that say which of the
// list's items are records.
//
// `slot.ts` is the whole of what a caller needs; `columns.ts` and
// `conditions.ts` are what it is made of, and are its own to reach.

export { resolveWebExtractionSlot, type WebExtractionSlotIssue, type WebExtractionSlotResolution } from "./slot";
