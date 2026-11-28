// Whether a page has finished the work it scheduled for itself and stopped
// changing (task speed S10, `../automation-tab.ts` `waitForTabReady`). The load
// event does not say so: local-classifieds draws a listing's panel from a timer
// and then a request (`run-mwalxlxu-efd58e23`), and its sorted results after an
// address rewritten in place, a short delay and a request (`run-mwaliwap-12e3ad05`).
// The page world counts that work (`page-world/page-work/`); a function injected
// into the top frame asks it and waits on it (`../../shared/scheduled-work-settled.ts`),
// for no longer than the worker's wait has left (t1094): an injected question
// that outlived the wait stayed in the page, still observing, on every page
// that never settled.

import { PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../shared/scheduled-work-event";
import { pageSettledInPage } from "../../shared/scheduled-work-settled";
import { executeInTab } from "../../background/tab-gate";

/** Whether the tab's top document has finished drawing itself within `withinMs`; false when no page world can say, the page cannot be reached, or the time ran out. */
export async function pageWorkSettled(tabId: number, withinMs?: number): Promise<boolean> {
  try {
    const [answer] = await executeInTab({
      target: { tabId, frameIds: [0] },
      args: [PAGE_WORK_WATCHED_EVENT, PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, withinMs === undefined ? {} : { withinMs: Math.max(0, withinMs) }],
      func: pageSettledInPage
    });
    return answer?.result === true;
  } catch {
    // A page the worker cannot inject into (a browser page, a document leaving) says nothing.
    return false;
  }
}
