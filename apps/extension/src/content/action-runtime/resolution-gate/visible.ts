/**
 * Visible enough to be the element a command meant: in the document, with a
 * box, and not hidden by a style that collapses it.
 *
 * This is deliberately weaker than `../actionability.ts`, which scrolls the
 * element into view and hit-tests it. Resolution answers "which element is
 * this?" and must not move the page to do it; whether the answer can then be
 * clicked is the actionability gate's question, asked after.
 */
export function isVisibleForResolution(element: Element): boolean {
  if (!element.isConnected) return false;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
