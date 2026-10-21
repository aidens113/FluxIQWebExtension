// How the sandbox answers every request the snapshot page makes (lane T U3,
// decisions 1 and 2): the primary at the snapshot's own address, once, with
// page scripts off; each carried resource at the address it was carried from,
// with its media type (a frame document with page scripts off too); a
// navigation the snapshot cannot answer held with `204 No Content`, which
// leaves the frame's document where it is (an abort would put the browser's
// error page there); any other request answered with nothing. The decision is
// pure, so the browser side only fulfils it and counts.

import type { WebPageSnapshot } from "@fluxiq-web-extension/domain/node";

export type SnapshotRouteRequest = Readonly<{ url: string; navigation: boolean }>;

export type SnapshotRouteAnswer =
  | Readonly<{ kind: "served"; headers: Readonly<Record<string, string>>; body: Uint8Array }>
  | Readonly<{ kind: "held" }>
  | Readonly<{ kind: "refused" }>;

export type SnapshotRoutes =
  | Readonly<{ status: "ready"; answer(request: SnapshotRouteRequest): SnapshotRouteAnswer }>
  | Readonly<{ status: "unavailable"; detail: string }>;

const SCRIPTS_OFF = "script-src 'none'";
const DOCUMENT_TYPE = /^\s*(?:text\/html|application\/xhtml\+xml)\b/iu;

/** The route for `snapshot`, its primary document passed through `arm` (the canaries) before it is served. */
export function snapshotRoutes(snapshot: WebPageSnapshot, arm: (html: string) => string): SnapshotRoutes {
  if (!DOCUMENT_TYPE.test(snapshot.primary.mediaType)) {
    return { status: "unavailable", detail: `the snapshot's primary part is ${snapshot.primary.mediaType}, not a document` };
  }
  const pageAddress = withoutFragment(snapshot.url);
  if (pageAddress === undefined) return { status: "unavailable", detail: "the snapshot's address is not a web address" };
  const primaryBody = new TextEncoder().encode(arm(new TextDecoder("utf-8").decode(snapshot.primary.bytes)));
  const primaryType = /charset=/iu.test(snapshot.primary.mediaType) ? snapshot.primary.mediaType : `${snapshot.primary.mediaType}; charset=utf-8`;
  const resources = new Map<string, SnapshotRouteAnswer>();
  for (const resource of snapshot.resources) {
    const address = resource.source === null ? undefined : withoutFragment(resource.source);
    if (address === undefined || resources.has(address)) continue;
    const headers: Record<string, string> = { "content-type": resource.mediaType };
    if (DOCUMENT_TYPE.test(resource.mediaType)) headers["content-security-policy"] = SCRIPTS_OFF;
    resources.set(address, { kind: "served", headers, body: resource.bytes });
  }
  let primaryServed = false;
  return {
    status: "ready",
    answer: (request) => {
      const address = withoutFragment(request.url);
      if (request.navigation && address === pageAddress && !primaryServed) {
        primaryServed = true;
        return { kind: "served", headers: { "content-type": primaryType, "content-security-policy": SCRIPTS_OFF }, body: primaryBody };
      }
      const resource = address === undefined || address === pageAddress ? undefined : resources.get(address);
      if (resource) return resource;
      return request.navigation ? { kind: "held" } : { kind: "refused" };
    }
  };
}

/** `address` without its fragment, which a browser never sends; undefined when it does not parse. */
function withoutFragment(address: string): string | undefined {
  if (!URL.canParse(address)) return undefined;
  const parsed = new URL(address);
  parsed.hash = "";
  return parsed.href;
}
