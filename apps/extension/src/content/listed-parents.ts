// Which listed element each listed element sits inside (t223).
//
// The snapshot's list is flat (`rendered-elements.ts`), so a reader that wants
// to know that a link's words are its list item's words, or that a button sits
// in a dialog, had to guess from text and boxes. Each descriptor therefore
// carries `parent`: the index, in the same list, of its nearest ancestor that
// is also listed. Ancestry is the composed tree's, the one a person sees: a
// light child a slot places sits in that slot, a shadow root's top-level
// children sit in its host, and everything else in its parent element. An
// element with no listed ancestor -- the page's top-level content, whose
// parents are `body` and `html` -- has none.

/** `DOCUMENT_FRAGMENT_NODE`, which a shadow root is; read off the node rather than off a global. */
const DOCUMENT_FRAGMENT_NODE = 11;

/** For each element, the index of its nearest listed composed ancestor in `elements`, or `undefined`. */
export function listedParentIndexes(elements: readonly Element[]): Array<number | undefined> {
  const indexOf = new Map<Element, number>();
  elements.forEach((element, index) => indexOf.set(element, index));
  return elements.map((element) => {
    for (let ancestor = composedParent(element); ancestor; ancestor = composedParent(ancestor)) {
      const index = indexOf.get(ancestor);
      if (index !== undefined) return index;
    }
    return undefined;
  });
}

/** The element's parent in the composed tree: its assigned slot, its parent element, or its shadow root's host. */
function composedParent(element: Element): Element | null {
  const slot = element.assignedSlot;
  if (slot) return slot;
  if (element.parentElement) return element.parentElement;
  const node = element.parentNode;
  return node?.nodeType === DOCUMENT_FRAGMENT_NODE ? (node as ShadowRoot).host ?? null : null;
}
