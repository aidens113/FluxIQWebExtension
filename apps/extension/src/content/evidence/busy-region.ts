// A region the author marked as still working: `aria-busy="true"`, and
// painted (`painted.ts`), so a busy flag left on a hidden or empty container
// is not read as the page loading.
//
// One rule for two readers. The snapshot's loading evidence lists every such
// region (`loading.ts`), and the in-place effect watch
// (`../action-runtime/in-place-effect.ts`) holds a link click's answer while a
// region it saw change is still one, so a filter whose results column is
// fetching is not answered by the menu that closed in front of it (t733).

import { isPainted } from "./painted";

const BUSY_SELECTOR = "[aria-busy='true']";

/** Whether `element` is a painted region marked `aria-busy="true"`. */
export function isBusyRegion(element: Element): boolean {
  return element.matches(BUSY_SELECTOR) && isPainted(element);
}
