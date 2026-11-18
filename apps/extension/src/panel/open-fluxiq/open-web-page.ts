// Opens a page of FluxIQ's web panel in a new tab straight from the panel, for the links that name a page
// the background's Open FluxIQ message does not (a run's data). The address is built from the configured
// web address only (`shared/fluxiq-web-routes.ts`); no token or recorded data goes in it.

import { fluxIQWebPageAddress, type FluxIQWebPage } from "../../shared/fluxiq-web-routes";

/** Opens `page` on `coreApiUrl` in a new tab; false when that address is not an http(s) address. */
export function openFluxIQWebPage(coreApiUrl: string | undefined, page: FluxIQWebPage, open: (url: string) => void = openInTab): boolean {
  const url = fluxIQWebPageAddress(coreApiUrl, page);
  if (url === undefined) return false;
  open(url);
  return true;
}

function openInTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
