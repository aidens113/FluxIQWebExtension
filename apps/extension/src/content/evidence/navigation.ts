// How this document was reached.
//
// The snapshot has always carried `url` and `title`, which say where the page
// is but nothing about how it got there. That is the difference between a
// navigation that worked and one that bounced: a login redirect and a direct
// hit look identical by URL alone, a reload and a fresh visit look identical,
// and nothing says whether going back is even possible. The background worker
// keeps a navigation recorder, but it is recording-only and lives a process
// away; these are the facts the page itself can state at capture time.
//
// The URL is split as well as carried whole because a reader comparing an
// expected destination to a real one almost always wants the path without the
// query string, and splitting it here is one parse rather than one per reader.

import { boundedText } from "../identity";
import { present } from "../../shared/present";
import type { NavigationEvidence } from "./types";

const MAX_URL_LENGTH = 2_000;

export function navigationEvidence(): NavigationEvidence {
  const entry = navigationTiming();
  const url = new URL(location.href);
  const referrer = boundedText(document.referrer, MAX_URL_LENGTH);
  return present<NavigationEvidence>({
    url: location.href.slice(0, MAX_URL_LENGTH),
    origin: url.origin,
    path: url.pathname,
    referrer: referrer || undefined,
    type: entry?.type || undefined,
    redirects: entry && entry.redirectCount > 0 ? entry.redirectCount : undefined,
    historyLength: history.length,
    visibility: document.visibilityState
  });
}

/**
 * The Navigation Timing entry for this document. It is absent in some frames
 * and in browsers that do not keep the buffer, and reading it must never be the
 * reason a snapshot fails, so every failure returns nothing rather than throwing.
 */
function navigationTiming(): PerformanceNavigationTiming | undefined {
  try {
    const [entry] = performance.getEntriesByType("navigation");
    return entry instanceof PerformanceNavigationTiming ? entry : undefined;
  } catch {
    return undefined;
  }
}
