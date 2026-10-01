// An element's attributes: read in whichever form the capture sent them, and
// published as `[name, value]` pairs in the page's order (t200).
//
// Pairs, never an object keyed by name. Core's denied-key screen walks keys at
// every depth and refuses the whole request for one, and `headers` -- a real
// `td` attribute -- and `selector` are among this domain's denied keys
// (`./denied-keys.ts`). As pairs an attribute name is only ever a string.
//
// Every name and value is screened (`./withheld.ts`), and a value that names a
// URL is screened as a link is (`./location.ts`). The one attribute left out is
// the extension's own frame stamp, which is not the page's.

import { screenedUrlAttribute } from "./location";
import { isJsonRecord } from "./untrusted-json";
import { screenedText } from "./withheld";

/**
 * Stamped onto a child frame's element by the frame merge
 * (`apps/extension/src/background/connection/frame-geometry.ts`), so a packet
 * element can say which frame it lives in.
 */
export const WEB_LLM_FRAME_ID_ATTRIBUTE = "data-fluxiq-frame-id";

/** Attributes whose value is a URL, screened as a link is. */
const URL_ATTRIBUTES: ReadonlySet<string> = new Set(["href", "src", "action", "formaction", "poster", "cite", "background", "longdesc", "ping", "data-href", "data-src", "data-url", "data-fluxiq-frame-url"]);

/**
 * The attributes as the capture sent them: `[name, value]` pairs in the
 * page's order, or an object keyed by name, whose insertion order is the
 * capture's. Anything that is not a string pair is not an attribute.
 */
export function rawAttributes(input: unknown): Array<[string, string]> {
  const entries: unknown[] = Array.isArray(input) ? input : isJsonRecord(input) ? Object.entries(input) : [];
  return entries.flatMap((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && entry[0] !== "" && typeof entry[1] === "string"
    ? [[entry[0], entry[1]] as [string, string]]
    : []);
}

/** The attributes by name, for the rules that ask about one: the first of a repeated name wins, as it does in a browser. */
export function attributeRecord(attributes: ReadonlyArray<[string, string]>): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [name, value] of attributes) {
    const key = name.toLowerCase();
    if (!Object.hasOwn(record, key)) record[key] = value;
  }
  return record;
}

/** Every attribute but the extension's own frame stamp, each name and value screened. */
export function publishedAttributes(attributes: ReadonlyArray<[string, string]>, base: URL): Array<[string, string]> | undefined {
  const published = attributes.flatMap(([name, value]): Array<[string, string]> => {
    const key = name.toLowerCase();
    if (key === WEB_LLM_FRAME_ID_ATTRIBUTE) return [];
    return [[screenedText(name), URL_ATTRIBUTES.has(key) ? screenedUrlAttribute(value, base) : screenedText(value)]];
  });
  return published.length ? published : undefined;
}
