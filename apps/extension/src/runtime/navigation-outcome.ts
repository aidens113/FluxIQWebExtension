// Did the browser land where the action asked it to go, and did it go
// anywhere at all?
//
// Navigation used to report the requested URL back as `succeeded` without ever
// looking at the tab, so a redirect to a login page, a consent wall, or an
// error page was indistinguishable from success (plan decision D4). This is the
// comparison behind that post-condition.
//
// It is deliberately tolerant of the rewrites a site performs on its own
// address and intolerant of the ones that mean somewhere else: an http->https
// upgrade, a "www." prefix, a trailing slash, and a fragment are the same
// destination; a different host or path is not. A query string is compared only
// when the request carried one, so tracking parameters a site appends do not
// fail an action that never asked about them.
//
// A destination check alone is not enough, and the second half of this module
// is why. Comparing the requested address with the landed one asks "is the tab
// where the Flow asked for?", and a navigation to the page the tab already
// shows passes that question without the browser doing anything: the address
// was already right. `judgeTabMovement` asks the other question -- "did this
// navigation do any work?" -- from the record `automation-tab.ts` keeps of the
// drive. That is the check the campaign's one created Flow needed: its opening
// navigate reported success on a tab that never left the page it started on,
// and the click after it then failed on a page the Flow thought it had
// replaced (`w2x-e2e-lane-b.md`, product gap 6).
//
// The evidence is Chrome's top-frame document UUID, read before the drive and
// after the tab settles. It changes for every document the browser loads,
// including a reload, and it does not change for a same-document move, which
// is why the address is consulted as well: a navigation to a fragment of the
// current page moves the address and keeps the document, and it did work.
// Nothing to compare -- a browser that would not say, or a drive that was
// never made -- is reported as unknown and never as a no-op, because a check
// that cannot see is not a check that failed.

import type { TabDriveRecord } from "./automation-tab";

export type NavigationComparison = {
  matched: boolean;
  /** The requested URL, for the validation and the failure record. */
  expected: string;
  /** Where the tab actually is, or `(unknown)` when its URL could not be read. */
  actual: string;
};

const UNKNOWN_URL = "(unknown)";

/**
 * `loadFailed` is the browser's word that the top frame's last navigation ended
 * in an error. Chrome then shows its own error page but keeps the requested URL
 * in the address bar, so the address alone would call a refused connection an
 * arrival.
 */
export function compareNavigatedUrl(requested: string, landed: string | undefined, loadFailed = false): NavigationComparison {
  const actual = landed?.trim() ? landed.trim() : UNKNOWN_URL;
  // An unreadable URL is not proof of arrival. Reporting it as a match would
  // restore exactly the silent success this comparison exists to remove.
  if (actual === UNKNOWN_URL) return { matched: false, expected: requested, actual };
  if (loadFailed) return { matched: false, expected: requested, actual: `the browser could not load ${actual}` };
  return { matched: sameDestination(requested, actual), expected: requested, actual };
}

function sameDestination(requested: string, landed: string): boolean {
  if (requested === landed) return true;
  const wanted = parseUrl(requested);
  const reached = parseUrl(landed);
  if (!wanted || !reached) return false;
  if (!(isWebScheme(wanted.protocol) && isWebScheme(reached.protocol)) && wanted.protocol !== reached.protocol) return false;
  if (hostOf(wanted) !== hostOf(reached)) return false;
  if (pathOf(wanted) !== pathOf(reached)) return false;
  return wanted.search === "" || wanted.search === reached.search;
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isWebScheme(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

function hostOf(url: URL): string {
  return url.host.toLowerCase().replace(/^www\./u, "");
}

function pathOf(url: URL): string {
  return url.pathname.replace(/\/+$/u, "");
}

/** What the drive did to the tab: whether the navigation was any work at all, and how to say so. */
export type NavigationMovement = {
  /** False only on positive evidence that the tab kept both its address and its document. */
  moved: boolean;
  /** Whether the record said enough to judge. An unknown movement is reported, never failed. */
  known: boolean;
  /** What happened, for the validation and the failure record. */
  detail: string;
};

/**
 * Whether driving the tab moved it. The record comes from
 * `automation-tab.ts`'s `updateTabUrl`, or is absent when the navigation
 * never drove anything.
 */
export function judgeTabMovement(drive: TabDriveRecord | undefined): NavigationMovement {
  if (!drive) return { moved: true, known: false, detail: "nothing drove the tab, so what it did could not be read" };
  if (drive.opened) return { moved: true, known: true, detail: "the browser opened a tab for this navigation" };
  if (drive.urlBefore !== undefined && drive.urlAfter !== undefined && drive.urlBefore !== drive.urlAfter) {
    return { moved: true, known: true, detail: `the tab moved from ${drive.urlBefore}` };
  }
  if (drive.documentBefore === undefined || drive.documentAfter === undefined) {
    return { moved: true, known: false, detail: "the browser would not say which document the tab holds, so the reload could not be confirmed" };
  }
  if (drive.documentBefore !== drive.documentAfter) {
    return { moved: true, known: true, detail: drive.reloaded ? "the browser loaded the page again" : "the browser loaded a new document" };
  }
  return {
    moved: false,
    known: true,
    detail: drive.reloaded
      ? "the tab was already showing that address and the browser did not load the page again"
      : "the tab kept the document it already held"
  };
}
