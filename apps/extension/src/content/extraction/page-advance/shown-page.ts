// Which page of a list the document shows, as its pager marks it: the number
// a next-page step reports after it moves (`page` in contract C1's answer),
// and the page a numbered step counts on from. Only numbers are read, and only
// to report and compare them; no word of the page is carried anywhere.

import type { WebAutomationNextPageWay } from "../../../shared/protocol";
import { nextControlOnPage } from "../detect-pagination";
import { currentPageNumber, readPager } from "../pager-reading";

/**
 * The number the pager marks current, or `undefined` where it marks none or
 * the list continues by loading more or scrolling, which shows no pages. A
 * numbered pager is read from its own controls; any other from the pager
 * around the Next the way names, or the one found from the list.
 */
export function pageShownNow(way: WebAutomationNextPageWay | undefined, item: string): number | undefined {
  if (way?.mode === "loadMore" || way?.mode === "scroll") return undefined;
  if (way?.mode === "numbered") {
    const controls = Array.from(document.querySelectorAll(way.pages));
    const first = controls[0];
    return currentPageNumber(controls) ?? (first instanceof HTMLElement ? readPager(first)?.current : undefined);
  }
  const named = way === undefined ? null : document.querySelector(way.next);
  const found = nextControlOnPage(named, Array.from(document.querySelectorAll(item)));
  return found?.control instanceof HTMLElement ? readPager(found.control)?.current : undefined;
}
