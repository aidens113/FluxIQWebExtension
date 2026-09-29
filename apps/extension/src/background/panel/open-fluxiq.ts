// "Open FluxIQ": the web panel's address, as a tab. It is the fallback for
// anything the extension's panel cannot do itself, so it opens whatever address
// the settings hold -- and only a web address, so a mistyped or hostile setting
// can never open a `javascript:` or `file:` URL.

import { DEFAULT_CORE_API_URL } from "../../shared/constants";

/** The web panel's address to open, or undefined when the setting is not an http(s) address. */
export function fluxIQWebAddress(coreApiUrl: string | undefined): string | undefined {
  const url = parsedAddress(coreApiUrl?.trim() || DEFAULT_CORE_API_URL);
  return url && (url.protocol === "http:" || url.protocol === "https:") ? url.toString() : undefined;
}

// `URL.canParse` would say this without a throw, but it arrived in Firefox 115
// and the manifest still admits 109. A `TypeError` from the constructor is the
// one failure that means "not an address"; anything else is rethrown.
function parsedAddress(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
