// Whether a list the page loads in parts is still loading its next part: what
// a scroll that has not yet brought a new item waits on before the list counts
// as ended (`./scroll-for-more.ts`).
//
// Live run `run-mvcvzwk1-c1d869e4` (2026-10-17): a Next page step on a feed
// that fetches its next batch when its end nears the bottom of the screen
// scrolled the window to the bottom, saw no new item within the 900 ms growth
// window, found the window at the bottom and answered `ended:
// scrolled_to_end`. The feed was marked `aria-busy="true"` and showed two
// placeholder cards for the batch on its way, and the batch arrived a moment
// later; the Flow read one page of a feed that went on, and Core's record said
// the list had ended. A batch slower than the window is a page loading, not a
// list ending.
//
// What says a list is still loading, all of it page structure and none of it
// page words:
// - `aria-busy="true"` on the list's container or an ancestor of it, or on or
//   inside an element of the list's tail;
// - `role="progressbar"` on or inside an element of the tail;
// - a placeholder the page added to the tail since the watch began and still
//   shows: an element with no text, or one marked `aria-hidden="true"` -- a
//   skeleton card or a spinner standing in for the part on its way. An element
//   added with text is not one: an end note ("no more results") is added
//   exactly when nothing more is coming.
//
// The tail is what follows the list's last item: the container's other
// children after it, and the first few elements after the container, which is
// where a page puts its loader, its sentinel and its end note. Nothing inside
// an item counts, so an item's own lazy part never keeps the list waiting.

/** How many elements after the list's container belong to its tail. */
const FOLLOWING_SIBLINGS = 3;

/** A watch over one list's loading, begun before the scroll it judges. */
export type ListLoading = {
  /** Whether the page shows the list loading now (see the header). */
  shown(): boolean;
  /** Whether the tail is not what it was at the last look, the first look comparing with the start. */
  moved(): boolean;
};

const NOTHING_SHOWN: ListLoading = { shown: () => false, moved: () => false };

/**
 * Watches the loading of the list whose items match `item` and whose first
 * shown item is `first`; a list with no shown item has no container to watch
 * and never shows loading.
 */
export function watchListLoading(item: string, first: Element | undefined): ListLoading {
  const container = first?.parentElement ?? null;
  if (!container) return NOTHING_SHOWN;
  const start = new Set(tailOf(container, item));
  let last: readonly Element[] = [...start];
  return {
    shown: () => {
      if (container.closest('[aria-busy="true"]')) return true;
      return tailOf(container, item).some((element) => isBusy(element) || (!start.has(element) && isPlaceholder(element)));
    },
    moved: () => {
      const now = tailOf(container, item);
      const moved = now.length !== last.length || now.some((element, index) => element !== last[index]);
      last = now;
      return moved;
    }
  };
}

/** The list's tail (see the header), in document order. */
function tailOf(container: Element, item: string): Element[] {
  const items = new Set(Array.from(document.querySelectorAll(item)));
  const children = Array.from(container.children);
  let lastItem = -1;
  children.forEach((child, index) => {
    if (items.has(child)) lastItem = index;
  });
  const tail = children.slice(lastItem + 1).filter((child) => !items.has(child));
  let sibling = container.nextElementSibling;
  for (let count = 0; sibling && count < FOLLOWING_SIBLINGS; count += 1, sibling = sibling.nextElementSibling) tail.push(sibling);
  return tail;
}

function isBusy(element: Element): boolean {
  if (element.getAttribute("aria-busy") === "true" || element.getAttribute("role") === "progressbar") return true;
  return element.querySelector('[aria-busy="true"],[role="progressbar"]') !== null;
}

function isPlaceholder(element: Element): boolean {
  return element.getAttribute("aria-hidden") === "true" || !/\S/u.test(element.textContent ?? "");
}
