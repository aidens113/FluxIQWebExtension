// Where the page is, and where its links go, stated whole but for their
// secrets (t200).
//
// Until 2026-09-30 the packet's `location` was origin plus pathname and nothing
// else, every cross-origin link was dropped, and a URL over 2,000 characters
// threw, so the page was not seen at all. A query is often the page's own state
// -- a search term, a filter, a page number -- and a model that cannot read it
// cannot tell one results page from another. So the query and the fragment are
// kept, in the order the page wrote them, and only what is secret is withheld:
//
//  - the value of a parameter whose name says it holds a secret (a token, a
//    key, a session, a signature, a one-time code, a credential, an auth
//    ticket), and
//  - any value, path or fragment Core's credential check matches
//    (`./withheld.ts`).
//
// A URL carrying embedded credentials (`https://user:pass@host/`) is still
// refused: as the page's own location it throws, and as a link it is dropped.

import { WEB_LLM_WITHHELD_TEXT, screenedText } from "./withheld";

/** What a withheld query value, path or fragment reads as inside a URL: plain characters, so the URL still parses. */
const WITHHELD_URL_PART = "(withheld)";

/**
 * Words a parameter name is split into that say its value is a secret. Matched
 * as whole words (`api_key`, `apiKey`, `X-Amz-Signature`), never as substrings,
 * so `keyword`, `zipcode` and `author` are ordinary parameters.
 */
const SECRET_PARAMETER_WORDS: ReadonlySet<string> = new Set([
  "token", "tokens", "accesstoken", "idtoken", "jwt",
  "key", "keys", "apikey",
  "secret", "secrets",
  "password", "passwd", "pwd", "pass", "passcode",
  "auth", "authorization", "authtoken",
  "session", "sessionid", "sid",
  "sig", "signature",
  "code", "otp",
  "credential", "credentials",
  "ticket"
]);

/** An HTTP(S) URL with no embedded credentials. Anything else throws. */
export function safeEvidenceUrl(input: unknown): URL {
  if (typeof input !== "string" || !input) throw new Error("web evidence URL must be a non-empty string");
  const url = new URL(input);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) throw new Error("web evidence URL must be an HTTP(S) URL without credentials");
  return url;
}

/** A URL spelled and screened as a location is, or `undefined` when it is not a safe HTTP(S) URL. */
export function screenedEvidenceUrl(input: unknown): string | undefined {
  try {
    return evidenceLocation(safeEvidenceUrl(input));
  } catch {
    return undefined;
  }
}

/**
 * The packet's spelling of a location: origin, path, query and fragment, with
 * every secret withheld. Always a URL that parses, so a reader may take its
 * origin.
 */
export function evidenceLocation(url: URL): string {
  const path = screenedText(url.pathname) === url.pathname ? url.pathname : `/${WITHHELD_URL_PART}`;
  const query = url.search.length > 1 ? `?${screenedPairs(url.search.slice(1))}` : "";
  const fragment = url.hash.length > 1 ? `#${screenedFragment(url.hash.slice(1))}` : "";
  return `${url.origin}${path}${query}${fragment}`;
}

/**
 * Where a link goes, whole: another origin as much as this one. An HTTP(S)
 * destination is spelled as a location is; any other scheme (`mailto:`,
 * `tel:`, `javascript:`) is published as written, screened. A destination with
 * embedded credentials is dropped.
 */
export function evidenceHref(input: unknown, base: URL): string | undefined {
  if (typeof input !== "string" || !input.trim()) return undefined;
  let url: URL;
  try {
    url = new URL(input, base);
  } catch {
    return screenedText(input.trim());
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return screenedText(input.trim());
  if (url.username || url.password) return undefined;
  return evidenceLocation(url);
}

/**
 * An attribute value that names a URL (`href`, `src`, `action`), screened as a
 * link is. A value with embedded credentials is withheld whole rather than
 * dropped, because the attribute itself is still there.
 */
export function screenedUrlAttribute(value: string, base: URL): string {
  return evidenceHref(value, base) ?? WEB_LLM_WITHHELD_TEXT;
}

/** Whether a query parameter's name says its value is a secret. */
export function secretParameterName(name: string): boolean {
  const words = decoded(name)
    .split(/[^A-Za-z0-9]+|(?<=[a-z0-9])(?=[A-Z])/u)
    .map((word) => word.toLowerCase())
    .filter(Boolean);
  return words.some((word) => SECRET_PARAMETER_WORDS.has(word)) || SECRET_PARAMETER_WORDS.has(words.join(""));
}

/** `a=1&b=2`, each pair as written unless its name or its value is secret. */
function screenedPairs(query: string): string {
  return query.split("&").map((pair) => {
    const at = pair.indexOf("=");
    const name = at < 0 ? pair : pair.slice(0, at);
    const value = at < 0 ? "" : pair.slice(at + 1);
    if (at < 0) return screenedText(decoded(name)) === decoded(name) ? pair : WITHHELD_URL_PART;
    if (secretParameterName(name) || screenedText(decoded(value)) !== decoded(value)) return `${name}=${WITHHELD_URL_PART}`;
    return pair;
  }).join("&");
}

/** A fragment is screened as a query when it is written as one (`#access_token=...`), and whole otherwise. */
function screenedFragment(fragment: string): string {
  if (fragment.includes("=")) return screenedPairs(fragment);
  return screenedText(decoded(fragment)) === decoded(fragment) ? fragment : WITHHELD_URL_PART;
}

function decoded(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/gu, " "));
  } catch {
    return text;
  }
}
