// Resolving an extraction node's list: the `extractList` slot a model wrote,
// the detected columns it keeps, and the conditions that say which of the
// list's items are records.
//
// `slot.ts` is the whole of what a caller needs; `columns.ts`, `conditions.ts`
// and `column-match.ts` are what it is made of, and are its own to reach. The
// one exception is the assumption a resolved slot reports, which is part of the
// answer rather than part of the making of it.

export { type WebExtractionColumnAssumption } from "./column-match";
export { resolveWebExtractionSlot, type WebExtractionSlotIssue, type WebExtractionSlotResolution } from "./slot";
