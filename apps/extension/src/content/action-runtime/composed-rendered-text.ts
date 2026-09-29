// What a reader of the page sees as text, open shadow roots included: the
// in-place effect watch compares two readings of it to tell whether a click's
// handler showed anything new.
//
// `body.innerText` is the reader's view of the document tree, but a panel a
// web component opens inside its own shadow root is not in that tree: the
// "Change store" flyout on bigbox (`run-mum0ke7z-940cbd27`) is un-hidden inside
// `vr-fulfillment-picker`'s root, and a reading of the body alone never moves.
// So each open root adds its own reading, taken from its rendered top-level
// elements.
//
// Only rendered elements are read. `innerText` of an element with no box --
// `display: none`, `hidden`, or under a hidden host -- falls back to its
// `textContent`, which would put a closed panel's text in the baseline and make
// opening it change nothing. An element with `display: contents` has no box of
// its own but draws its children, so it is read through them. A text node that
// sits directly in a root, outside any element, is not read. Nor is anything in
// a closed root, which cannot be reached.
//
// A browser whose `innerText` already follows a host into its root counts that
// text twice, once here and once in the host's tree. Both readings are taken
// the same way, so the comparison is unaffected.

/** Separates one tree's reading from the next, so text cannot move between trees unnoticed. */
const TREE_SEPARATOR = "\n\u0000\n";

/**
 * The page's rendered text: the body's, then each open shadow root's that
 * draws any, in the order given. The body's reading is empty for a document
 * with no body.
 */
export function composedRenderedText(document: Document, roots: Iterable<ShadowRoot>): string {
  const body = document.body as (HTMLElement & { innerText?: string }) | null;
  const readings = [typeof body?.innerText === "string" ? body.innerText : ""];
  const view = document.defaultView;
  // A root that draws nothing adds nothing, so a component that arrives empty
  // does not by itself read as new text.
  for (const root of roots) {
    const reading = renderedChildren(root.children, view);
    if (reading) readings.push(reading);
  }
  return readings.join(TREE_SEPARATOR);
}

/** The rendered text of each element in `elements`, descending through `display: contents`. */
function renderedChildren(elements: HTMLCollection | readonly Element[], view: Window | null): string {
  const parts: string[] = [];
  for (const element of [...elements]) {
    if (element.getClientRects().length > 0) {
      const text = (element as HTMLElement & { innerText?: string }).innerText;
      if (typeof text === "string" && text) parts.push(text);
    } else if (view?.getComputedStyle(element).display === "contents") {
      const inner = renderedChildren(element.children, view);
      if (inner) parts.push(inner);
    }
  }
  return parts.join("\n");
}
