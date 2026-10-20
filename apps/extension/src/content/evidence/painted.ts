// Whether an element is on screen in the sense a loading signal needs: an
// indicator or a busy region that is hidden, transparent or takes no space
// tells a reader nothing, so it is not evidence that the page is working.
// Shared by the snapshot's loading evidence (`loading.ts`) and, through the
// busy-region rule (`busy-region.ts`), by the in-place effect watch.

import { composedClosest } from "../shadow-dom";

/** On screen in the sense that matters here: rendered, not hidden, and occupying space. */
export function isPainted(element: Element): boolean {
  if (composedClosest(element, "[hidden],[aria-hidden='true']")) return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}
