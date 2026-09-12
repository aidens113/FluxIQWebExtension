// Did the browser land where the action asked it to go?
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

export type NavigationComparison = {
  matched: boolean;
  /** The requested URL, for the validation and the failure record. */
  expected: string;
  /** Where the tab actually is, or `(unknown)` when its URL could not be read. */
  actual: string;
};

const UNKNOWN_URL = "(unknown)";

export function compareNavigatedUrl(requested: string, landed: string | undefined): NavigationComparison {
  const actual = landed?.trim() ? landed.trim() : UNKNOWN_URL;
  // An unreadable URL is not proof of arrival. Reporting it as a match would
  // restore exactly the silent success this comparison exists to remove.
  if (actual === UNKNOWN_URL) return { matched: false, expected: requested, actual };
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
