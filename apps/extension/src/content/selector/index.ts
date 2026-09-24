// Selectors: how the content script writes down where an element is, so that
// whatever acts on the address later -- a plan's handle, a replay, an
// extraction's container -- reaches that element and no other.
//
// `unique-selector.ts` builds the selector and says why each form is unique.
// `element-anchors.ts` is the one list of identifiers a selector may quote, and
// why nothing a page shows or holds is on it. `volatile-identifier.ts` is the
// one rule for which of those identifiers a rendering generated, and so may not
// be addressed by at all -- by a selector written now, or by one written before
// the rule existed. `selector-memo.ts` lets one
// capture share the work its selectors have in common. `shadow/` is the other
// half of the address of an element inside a shadow root: the chain of hosts to
// walk before the selector means anything, and the walk itself.

export { elementAnchors } from "./element-anchors";
export { activeSelectorMemo, withSelectorMemo } from "./selector-memo";
export { deepElementFromPoint, resolveShadowScope, shadowHostChain } from "./shadow";
export { selectorFor } from "./unique-selector";
export { isVolatileIdentifier, selectorQuotesVolatileIdentifier } from "./volatile-identifier";

export type { ElementAnchor } from "./element-anchors";
export type { SelectorMemo } from "./selector-memo";
export type { LookupRoot, ShadowScope } from "./shadow";
