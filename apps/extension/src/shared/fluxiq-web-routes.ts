// The pages of FluxIQ's web panel the extension links to, as Core's web app
// serves them (`apps/web/src/app/(panel)` in FluxIQ Core): the home page `/`,
// `/projects` (list, create, rename, open), `/chats/<conversationId>?project=<projectId>`
// (one chat; the project is needed to find it), `/flows/<flowId>?project=<projectId>`,
// `/runs/<runId>`, `/data` (every project's collected tables) and
// `/security/keys`. Pure, so the background (which opens the tab) and the
// panel (which opens a data link itself) share one table.
// Only http(s) addresses are accepted, and no query or fragment of the
// configured address survives.

import { DEFAULT_CORE_API_URL } from "./constants";

/** A page of the web panel. */
export type FluxIQWebPage =
  | { readonly kind: "home" }
  | { readonly kind: "projects" }
  | { readonly kind: "chat"; readonly projectId: string; readonly conversationId: string }
  | { readonly kind: "flow"; readonly projectId: string; readonly flowId: string }
  | { readonly kind: "run"; readonly runId: string }
  | { readonly kind: "data" }
  | { readonly kind: "keys" };

/** The address of `page` on the configured web address, or undefined when that is not an http(s) address. */
export function fluxIQWebPageAddress(coreApiUrl: string | undefined, page: FluxIQWebPage): string | undefined {
  const url = parsedAddress(coreApiUrl?.trim() || DEFAULT_CORE_API_URL);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return undefined;
  if (page.kind === "home") return url.toString();
  url.search = "";
  url.hash = "";
  switch (page.kind) {
    case "projects":
      url.pathname = "/projects";
      break;
    case "chat":
      url.pathname = `/chats/${encodeURIComponent(page.conversationId)}`;
      url.searchParams.set("project", page.projectId);
      break;
    case "flow":
      url.pathname = `/flows/${encodeURIComponent(page.flowId)}`;
      url.searchParams.set("project", page.projectId);
      break;
    case "run":
      url.pathname = `/runs/${encodeURIComponent(page.runId)}`;
      break;
    case "data":
      url.pathname = "/data";
      break;
    case "keys":
      url.pathname = "/security/keys";
      break;
  }
  return url.toString();
}

// `URL.canParse` arrived in Chrome 120 and the Chrome manifest still admits 116. A `TypeError` from
// the constructor is the one failure that means "not an address"; anything else is rethrown.
function parsedAddress(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}
