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
//
// Both addresses are whole (t200); they were cut at 2,000 characters. What in
// an address is secret-shaped is the domain's to withhold, parameter by
// parameter, not a length's.
//
// `timeOrigin` says which document this is. `url` is `location.href`, so a page
// that rewrites its address in place (`history.replaceState`) and a new page
// look alike by address; in run `run-muw5zv4m-52d83027` a size choice that
// rewrote the address read as a page move and its change was dropped.
// `performance.timeOrigin` is one value per document, new for every document,
// and unchanged by `replaceState` and `pushState`.

import { present } from "../../shared/present";
import type { NavigationEvidence } from "./types";

export function navigationEvidence(): NavigationEvidence {
  const entry = navigationTiming();
  const url = new URL(location.href);
  const referrer = document.referrer.trim();
  return present<NavigationEvidence>({
    url: location.href,
    origin: url.origin,
    path: url.pathname,
    referrer: referrer || undefined,
    type: entry?.type || undefined,
    redirects: entry && entry.redirectCount > 0 ? entry.redirectCount : undefined,
    historyLength: history.length,
    visibility: document.visibilityState,
    timeOrigin: documentTimeOrigin()
  });
}

/**
 * This document's `performance.timeOrigin`, or nothing where the page has no
 * `performance` or reports no finite origin. Like the timing entry, reading it
 * must never be the reason a snapshot fails; the attribute is a plain number
 * with no failure of its own, so only its absence is guarded.
 */
function documentTimeOrigin(): number | undefined {
  const origin: unknown = typeof performance === "undefined" ? undefined : performance.timeOrigin;
  return typeof origin === "number" && Number.isFinite(origin) ? origin : undefined;
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
