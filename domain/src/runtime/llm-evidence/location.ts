// Where the page is, stated so it carries no secrets. A URL's query and hash
// are the usual home of session tokens, invitation codes and one-time links,
// so the packet's `location` is origin plus pathname and nothing else, and a
// link off the current origin is not reported at all.

import { WEB_LLM_EVIDENCE_BOUNDS } from "./limits";

/** An HTTP(S) URL with no embedded credentials, bounded in length. Anything else throws. */
export function safeEvidenceUrl(input: unknown): URL {
  if (typeof input !== "string" || !input || input.length > WEB_LLM_EVIDENCE_BOUNDS.url) throw new Error("web evidence URL must be bounded");
  const url = new URL(input);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) throw new Error("web evidence URL must be an HTTP(S) URL without credentials");
  return url;
}

/** The packet's spelling of a location: origin and pathname, never query or hash. */
export function evidenceLocation(url: URL): string {
  return `${url.origin}${url.pathname}`;
}

/** A link's destination, reported only when it stays on the page's own origin. */
export function sameOriginHref(input: unknown, base: URL): string | undefined {
  if (typeof input !== "string" || !input || input.length > WEB_LLM_EVIDENCE_BOUNDS.url) return undefined;
  try {
    const url = new URL(input, base);
    return url.origin === base.origin && (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
      ? evidenceLocation(url)
      : undefined;
  } catch {
    return undefined;
  }
}
