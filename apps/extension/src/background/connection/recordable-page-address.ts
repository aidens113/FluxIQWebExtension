// How a recording names the page a tab shows. The tab recorder names a recorded
// switch by it, and a replayed switch's confirmation names the tab it left in
// front by it. So a recorded switch and a replayed one always carry the same
// path, under the domain's own path rule (`webAutomationUrlPath`).

import { webAutomationUrlPath } from "@fluxiq-web-extension/domain/client";
import { unsupportedPageForUrl } from "./browser-state";

/**
 * The origin-and-path `location`, and the `path` alone, of a page a recording
 * can be in. None for a page a recording cannot see (`unsupportedPageForUrl`),
 * for an opaque origin, or for a pathname the domain's rule refuses. Neither
 * value ever holds a query or fragment.
 */
export function recordablePageAddress(url: string | undefined): { readonly location: string; readonly path: string } | undefined {
  if (!url || unsupportedPageForUrl(url)) return undefined;
  try {
    const parsed = new URL(url);
    const path = parsed.origin === "null" ? undefined : webAutomationUrlPath(parsed.pathname);
    return path === undefined ? undefined : { location: `${parsed.origin}${path}`, path };
  } catch {
    return undefined;
  }
}
