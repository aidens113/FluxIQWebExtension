// A detected list's rows beyond its columns (CC2, CC3): its marks, its row
// identity and each item's key and marks (`list-items.ts`), read off the
// detection's capture by `item-marks.ts` and `row-identity.ts`, which nothing
// outside this directory reads.

export { webLlmListItems, type WebLlmListItems, type WebLlmStructureItem, type WebLlmStructureMark } from "./list-items";
export type { WebLlmListItemField } from "./item-marks";
