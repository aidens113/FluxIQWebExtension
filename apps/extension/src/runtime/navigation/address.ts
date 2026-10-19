// The address a navigation drives a tab to.
//
// `chrome.tabs.update` and `chrome.tabs.create` resolve a relative url against
// the extension's own base, never against the page in the tab. A Flow that read
// a link off the page got its raw `href`, root-relative
// (`/scenarios/.../str/...`), navigated with it, and the tab landed on a missing
// `chrome-extension://` file; the browser's "cannot access" message was then
// classified as a permission refusal and told to the build as one (auction
// seller-shop run, F7). A person following that link reaches the same address on
// the page's own site, so a relative address is resolved here against the web
// page the Flow is on, as the page itself would resolve it.
//
// Only an http(s) page is a base. A browser page, an extension page, `about:blank`
// or FluxIQ's own panel is not where the Flow's link came from, so with no web
// page the address is refused, saying why. A navigation never drives a tab to the
// extension's own address either, written out or reached by resolving: no Flow
// means that, and the browser's refusal there would read as a permission.

import { parsedUrl } from "../../shared/parsed-url";

export type NavigationAddressContext = {
  /** The pages the Flow may be on, most specific first; the first web page that is not FluxIQ's own is the base. */
  pages: ReadonlyArray<string | undefined>;
  /** The origins of FluxIQ's own pages, which are never a base (`target.ts`). */
  ownOrigins: readonly string[];
  /** The extension's own base address (`chrome.runtime.getURL("")`), when known. */
  extensionUrl?: string | undefined;
};

/** Where to drive the tab, or why not: `refused` is the honest reason, worded for the step's `actual`. */
export type NavigationAddress = { url: string } | { refused: string };

/**
 * The address to drive the tab to. An address that parses on its own passes
 * unchanged; a relative one is resolved against the first web page among
 * `pages`. Refused when it is relative with no web page to resolve it against,
 * or when it is the extension's own address.
 */
export function navigationAddress(url: string, context: NavigationAddressContext): NavigationAddress {
  const absolute = parsedUrl(url.trim());
  const resolved = absolute === undefined ? resolvedAgainstPage(url.trim(), context) : url;
  if (resolved === undefined) {
    return { refused: `url "${url.trim()}" is relative and there is no web page to resolve it against, so nothing was sent to the browser` };
  }
  const own = authorityOf(context.extensionUrl);
  if (own !== undefined && authorityOf(resolved) === own) {
    return { refused: `url "${resolved}" is the extension's own address, which a Flow never navigates to, so nothing was sent to the browser` };
  }
  return { url: resolved };
}

function resolvedAgainstPage(relative: string, context: NavigationAddressContext): string | undefined {
  const own = new Set(context.ownOrigins.map((origin) => parsedUrl(origin)?.origin.toLowerCase()));
  for (const page of context.pages) {
    const base = page === undefined ? undefined : parsedUrl(page);
    if (base === undefined || (base.protocol !== "http:" && base.protocol !== "https:")) continue;
    if (own.has(base.origin.toLowerCase())) continue;
    return parsedUrl(relative, base.href)?.href;
  }
  return undefined;
}

/**
 * Scheme and host, lower-cased. Not `URL.origin`: `chrome-extension:` and
 * `moz-extension:` are not special schemes, so their origin is `"null"` and
 * their host keeps its case.
 */
function authorityOf(url: string | undefined): string | undefined {
  const parsed = url === undefined ? undefined : parsedUrl(url);
  if (parsed === undefined || parsed.host === "") return undefined;
  return `${parsed.protocol}//${parsed.host}`.toLowerCase();
}
