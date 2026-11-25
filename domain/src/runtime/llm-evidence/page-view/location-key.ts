// The key a page is delivered under (t1036, P-a). The domain decides what is
// "the same page"; Core only compares keys for equality and never reads one.
//
// A page's key is its URL without the query (user, 2026-11-25: the page key is
// the URL "not including the ? params"), normalized: the scheme and host as the
// URL parser lower-cases them, the port only when it is not the scheme's
// default, and the path without a trailing slash (the root `/` stays). The
// fragment is dropped unless it is a route (`#/...`, `#!...`), which names
// another view of an app that routes by fragment (the lead's reading: the user
// said nothing of fragments).
//
// So a filter, a sort or another page of the same list is the same key and
// arrives as the lines it changed, as does a dialog or a covering layer. Where
// a query names a different page (`?id=123`, a new search whose list is all
// new), Core's channel sends a diff longer than the base as a new base. Nothing
// about a key outlives the run.

const ROUTE_FRAGMENT = /^#[/!]/u;

/** The key of the page at `location`; a location that is not a URL is its own key. */
export function webLlmPageKey(location: string): string {
  let url: URL;
  try {
    url = new URL(location);
  } catch {
    return location;
  }
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/u, "") || "/" : url.pathname;
  const fragment = ROUTE_FRAGMENT.test(url.hash) ? url.hash : "";
  const authority = url.href.startsWith(`${url.protocol}//`) ? `//${url.host}` : "";
  return `${url.protocol}${authority}${path}${fragment}`;
}
