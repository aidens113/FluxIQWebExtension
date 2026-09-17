// The work one capture's selectors share.
//
// A snapshot describes up to 2,000 elements, and each selector is built on its
// parent's: a table's 240 rows would otherwise each rebuild the table's
// selector and each re-ask the page whether a row's test id is unique. Inside
// `withSelectorMemo` both answers are kept for the rest of the call, so every
// ancestor's selector and every anchor's page-wide match is computed once.
//
// Only for a synchronous call that does not change the page. That is what makes
// the kept answers true: a capture only reads. Outside a scope nothing is kept,
// so an action's descriptor -- built before a click, or after one that removed
// half the page -- is always measured against the page as it is then. A
// module-level cache cleared on a timer would not be: a click handler runs
// synchronously and can rewrite the page between two descriptors in one task.

/** What one scope keeps: each element's selector, and each anchor's sole match per search root (`null` when not exactly one). */
export type SelectorMemo = {
  readonly selectors: Map<Element, string>;
  readonly soleMatches: Map<Document | ShadowRoot, Map<string, Element | null>>;
};

let active: SelectorMemo | undefined;

/** Runs `capture` with one memo shared by every selector it builds. A nested call joins the outer scope. */
export function withSelectorMemo<T>(capture: () => T): T {
  if (active) return capture();
  active = { selectors: new Map(), soleMatches: new Map() };
  try {
    return capture();
  } finally {
    active = undefined;
  }
}

/** The memo of the scope currently running, if any. */
export function activeSelectorMemo(): SelectorMemo | undefined {
  return active;
}
