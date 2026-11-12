// What a hover showed: the elements rendered after it that were not before (t903, F5).
//
// A hover is judged by what it opened, as a press is judged by what answered it:
// a menu, a panel or a tip a person would now see. `renderedElements` is read
// before the hover, and `newlyRendered` polls after it until something is
// shown that was not, or its window closes -- a menu a script opens after a
// short delay is still the hover's.

/** How often the page is looked at while waiting for what a hover opens. */
const POLL_MS = 50;

/** Every element of `doc` the browser renders now. */
export function renderedElements(doc: Document): Set<Element> {
  const shown = new Set<Element>();
  for (const element of Array.from(doc.querySelectorAll("*"))) if (isRendered(element)) shown.add(element);
  return shown;
}

/** The elements rendered within `windowMs` that were not in `before`; empty when nothing new was shown. */
export async function newlyRendered(doc: Document, before: ReadonlySet<Element>, windowMs: number): Promise<Element[]> {
  const deadline = Date.now() + windowMs;
  for (;;) {
    const appeared = Array.from(doc.querySelectorAll("*")).filter((element) => !before.has(element) && isRendered(element));
    if (appeared.length > 0 || Date.now() >= deadline) return appeared;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

function isRendered(element: Element): boolean {
  const check = (element as Element & { checkVisibility?: (options?: Record<string, boolean>) => boolean }).checkVisibility;
  if (typeof check === "function") return check.call(element, { checkVisibilityCSS: true, visibilityProperty: true });
  return element.getClientRects().length > 0;
}
