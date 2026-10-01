// "Open FluxIQ": the web panel's address, as a tab. It is the fallback for
// anything the extension's panel cannot do itself. An automation uses Core's
// project/Flow route on that address; a generic button opens the address as
// configured. Only HTTP(S) is accepted, including for automation links.

import { DEFAULT_CORE_API_URL } from "../../shared/constants";

/** The panel or automation address, without adding any authentication material. */
export function fluxIQWebAddress(coreApiUrl: string | undefined, automation?: { projectId: string; flowId: string }): string | undefined {
  const url = parsedAddress(coreApiUrl?.trim() || DEFAULT_CORE_API_URL);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return undefined;
  if (automation) {
    url.pathname = "/programs/automation-studio";
    url.search = "";
    url.hash = "";
    url.searchParams.set("project", automation.projectId);
    url.searchParams.set("flow", automation.flowId);
  }
  return url.toString();
}

// `URL.canParse` would say this without a throw, but it arrived in Chrome 120
// and the Chrome manifest still admits 116. A `TypeError` from the constructor is the
// one failure that means "not an address"; anything else is rethrown.
function parsedAddress(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
