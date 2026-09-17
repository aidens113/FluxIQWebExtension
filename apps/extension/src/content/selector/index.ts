// Selectors: how the content script writes down where an element is, so that
// whatever acts on the address later -- a plan's handle, a replay, an
// extraction's container -- reaches that element and no other.
//
// `unique-selector.ts` builds the selector and says why each form is unique.
// `element-anchors.ts` is the one list of identifiers a selector may quote, and
// why nothing a page shows or holds is on it. `selector-memo.ts` lets one
// capture share the work its selectors have in common.

export { elementAnchors } from "./element-anchors";
export { activeSelectorMemo, withSelectorMemo } from "./selector-memo";
export { selectorFor } from "./unique-selector";

export type { ElementAnchor } from "./element-anchors";
export type { SelectorMemo } from "./selector-memo";
