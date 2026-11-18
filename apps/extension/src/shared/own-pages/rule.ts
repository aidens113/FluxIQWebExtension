// Which addresses are FluxIQ's own pages: every page served from the origin of
// its web panel (Core's web app, `coreApiUrl`) or of its gateway. That origin
// also serves the hosted sign-in routes -- `FLUXIQ_CONNECT_PATHS` (`/connect`,
// `/connect/authorize`, `/connect/done`, `/welcome`) are paths of the same web
// app -- so excluding the whole origin excludes them, and no route list is kept
// beside it to drift.
//
// One rule for both sides: the background's tab gate decides on a tab's address
// (`background/tab-gate/`), and the content script decides on the origin of the
// document a command reached (`content/own-document/`). A loopback panel answers
// as `127.0.0.1`, `localhost` and `[::1]` alike, so the three are one origin.

import { DEFAULT_CORE_API_URL, DEFAULT_GATEWAY_URL } from "../constants";
import { parsedUrl } from "../parsed-url";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The addresses of FluxIQ's own pages under these settings, each falling back to its default as the connection does. */
export function ownPageAddresses(settings: { readonly coreApiUrl?: string | undefined; readonly gatewayUrl?: string | undefined } | undefined): string[] {
  return [settings?.coreApiUrl || DEFAULT_CORE_API_URL, settings?.gatewayUrl || DEFAULT_GATEWAY_URL];
}

/** Whether `url` (an address or an origin) is on one of `addresses`' origins. An address with no origin of its own (`about:`, `data:`) is not. */
export function isOwnPageAddress(url: string | undefined, addresses: readonly string[]): boolean {
  const origin = url ? comparableOrigin(url) : undefined;
  if (origin === undefined) return false;
  return addresses.some((own) => own !== "" && comparableOrigin(own) === origin);
}

/** The origin, lower-cased, with every loopback host written one way; undefined for no origin. */
function comparableOrigin(url: string): string | undefined {
  const parsed = parsedUrl(url.trim());
  if (parsed === undefined || parsed.origin === "null") return undefined;
  const host = parsed.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) return parsed.origin.toLowerCase();
  return `${parsed.protocol}//loopback${parsed.port ? `:${parsed.port}` : ""}`;
}
