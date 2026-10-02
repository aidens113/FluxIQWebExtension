// Where the page's own pointer starts (t229).
//
// A content script cannot see a listener a page adds with `addEventListener`:
// it lives in the page's world, and the element carries no trace of it. So a
// page that draws its controls as `<div>`s -- the crossborder marketplace draws
// every one of them so: its search's magnifier, its consent answers, its option
// chips and colour swatches -- had none of them read as a control. They were
// listed, as plain text or, with no words, not at all, and the model searched
// the page for a search button it had been shown as nothing.
//
// What a person sees is the cursor. A page that wants an element pressed gives
// it a pointer, and one that refuses a press -- a sold-out option -- gives it
// `not-allowed`. A cursor is inherited, so every descendant of a pressable
// `<div>` reports the same pointer; only the element where the cursor begins,
// whose composed parent shows another, set it for itself. A link's pointer
// comes from the browser and is reported like any other: the reader decides
// what a pointer on an element the browser already makes a control means.

/** The cursor the element sets for itself, when it says "press here" or "this refuses a press"; `undefined` otherwise. */
export function ownPressCursor(element: Element): "pointer" | "not-allowed" | undefined {
  const cursor = getComputedStyle(element).cursor;
  if (cursor !== "pointer" && cursor !== "not-allowed") return undefined;
  const parent = composedParent(element);
  return parent !== null && getComputedStyle(parent).cursor === cursor ? undefined : cursor;
}

/** The element the cursor is inherited from: the slot that places it, its parent, or its shadow root's host. */
function composedParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode() as Node & { host?: Element };
  return root.host ?? null;
}
