// The way forward of a list that carried none: a next-page step whose list was
// detected with no pagination (`./step-page.ts`, an absent way).
//
// The pager's Next, found by walking up from the list's first item
// (`./follow-next.ts`), is followed wherever the page shows one, a disabled
// one included, so a control is always preferred to a scroll and a pager's
// last page still ends on its own word. Only where the page shows no way
// forward at all is the list scrolled for more (`./scroll-for-more.ts`): a
// list the page loads in parts as it is scrolled shows no control, and until
// 2026-10-17 such a list ended there on `control_absent` while the page would
// have drawn its next part, though Next page promises to scroll. Detection
// says a list scrolls only where the page declares a feed
// (`../detect-structure.ts`), and a list that grows on scroll declares nothing
// it has to. A list that does not grow ends there on `scrolled_to_end` once
// the scroll's bounded wait is over.

import { followNext } from "./follow-next";
import { scrollForMore } from "./scroll-for-more";
import type { PageStep, PaginationProgress } from "./types";

/** Follows the pager's Next found from the list, or scrolls the list for more where the page shows none; see the header. */
export async function followFoundWay(progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const step = await followNext(undefined, progress, bound);
  if (step.outcome !== "ended" || step.stop !== "control_absent") return step;
  return await scrollForMore(progress, bound);
}
