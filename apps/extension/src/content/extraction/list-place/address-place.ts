// A place the pager's own links carry in their address: the parameter a Next
// link moves along (`?page=3`, `?cursor=abc`, `?offset=40`), read from the
// document's own address under that same name. Only where the pager's control
// uses the parameter: an address parameter no pager control names says nothing
// about the list (invariant I3), and nothing is read from a row.

import type { ExtractionPlace } from "./place";
import { parsedUrl } from "../../../shared/parsed-url";
import { linkAddress } from "../pager-reading";

type Kind = ExtractionPlace["kind"];

/** The parameter names a pager moves along, by what each counts. A closed list: an unknown name is not a place. */
const PARAMETER_KINDS: ReadonlyMap<string, Kind> = new Map([
  ["page", "page"], ["pg", "page"], ["pagenum", "page"], ["pagenumber", "page"], ["paged", "page"], ["p", "page"],
  ["offset", "offset"], ["start", "offset"], ["skip", "offset"],
  ["cursor", "cursor"], ["after", "cursor"], ["page_token", "cursor"], ["pagetoken", "cursor"]
]);

const CURSOR = /^[A-Za-z0-9_.~-]{1,128}$/u;
const WHOLE_NUMBER = /^\d{1,9}$/u;

/** The value as a place of `kind`, or `undefined` for one that is not a clean page number, offset or token. */
function cleanPlace(kind: Kind, value: string): ExtractionPlace | undefined {
  if (kind === "cursor") return CURSOR.test(value) ? { kind, value } : undefined;
  if (!WHOLE_NUMBER.test(value)) return undefined;
  const number = Number(value);
  if (kind === "page") return number >= 1 ? { kind, value: number } : undefined;
  return { kind, value: number };
}

/**
 * The place the document's address names, under the parameter `control` (the
 * pager's Next or Load more link) itself moves along; `undefined` when the
 * control is no link, moves along no known parameter, or the document's
 * address does not carry that parameter cleanly.
 */
export function placeFromAddress(control: Element | null | undefined, documentUrl: string = document.URL): ExtractionPlace | undefined {
  if (!(control instanceof HTMLElement)) return undefined;
  const link = linkAddress(control);
  if (link === undefined) return undefined;
  const here = parsedUrl(documentUrl);
  if (here === undefined) return undefined;
  for (const [name] of link.searchParams) {
    const kind = PARAMETER_KINDS.get(name.toLowerCase());
    if (kind === undefined) continue;
    const value = here.searchParams.get(name);
    if (value === null) continue;
    const place = cleanPlace(kind, value);
    if (place !== undefined) return place;
  }
  return undefined;
}
