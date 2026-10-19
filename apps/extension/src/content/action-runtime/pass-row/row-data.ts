// Which of a control's signals are its row's data, and may differ between the
// build's row and the pass's (F2 note 1).
//
// A list's per-row control often names itself by its row: a title link's words
// are the row's title, its id `title-<code>` and its link `/view?id=<code>`
// carry the row's code, a gallery tile's name is its own counts. Copied from
// row to row, those signals are *expected* to differ, and weighed against the
// recording they refuse every row but the build's. This rule says which
// differences are row data, so the pass may place the control by structure.
//
// It is asked only of a candidate already in the recorded control's slot of
// the pass's own row (`row-slot.ts`), and only against the build's control
// found on the page as recorded -- so the whole saved fingerprint still chose
// that one. Everything else must agree exactly: the tag, the written role, the
// class set, the test id, an input's type. A name differs as row data only when
// it is, holds, or is held by one of the pass row's values; an id or link only
// when it keeps the recorded one's pattern -- the same stem with another
// per-row code, the same path shape and query keys. A name, id or link the
// build's control had and the candidate lacks, or the other way round, is a
// different control.

import { accessibleNameFor, normalizedText } from "../../identity";
import { parsedUrl } from "../../../shared/parsed-url";

/** Attributes whose value is a template's, the same on every row's copy. */
const TEMPLATE_ATTRIBUTES: readonly string[] = ["role", "type", "data-testid", "data-test-id", "data-qa", "name"];

/**
 * Whether `candidate` is `built`'s copy in another row: every template signal
 * equal, and every signal that differs a difference the pass row's `values`
 * account for by the rules in the header.
 */
export function differsOnlyByRowData(built: Element, candidate: Element, values: readonly string[]): boolean {
  if (tagOf(built) !== tagOf(candidate)) return false;
  if (TEMPLATE_ATTRIBUTES.some((name) => built.getAttribute(name) !== candidate.getAttribute(name))) return false;
  if (!sameClasses(built, candidate)) return false;
  return nameIsRowData(accessibleNameFor(built), accessibleNameFor(candidate), values)
    && sameIdPattern(built.getAttribute("id"), candidate.getAttribute("id"))
    && sameLinkPattern(built, candidate);
}

function sameClasses(built: Element, candidate: Element): boolean {
  const classes = (element: Element): string => [...new Set((element.getAttribute("class") ?? "").split(/\s+/u).filter(Boolean))].sort().join(" ");
  return classes(built) === classes(candidate);
}

/** Equal names, or a candidate name that is, holds, or is held by one of the row's values. */
function nameIsRowData(built: string | undefined, candidate: string | undefined, values: readonly string[]): boolean {
  if (built === candidate) return true;
  if (!built || !candidate) return false;
  return values.some((raw) => {
    const value = normalizedText(raw);
    return value !== undefined && (candidate === value || candidate.includes(value) || value.includes(candidate));
  });
}

/** Equal ids, or two ids of one stem -- the same text up to their last separator -- each with its own code after it. */
function sameIdPattern(built: string | null, candidate: string | null): boolean {
  if (built === candidate) return true;
  if (!built || !candidate) return false;
  const stem = (id: string): string | undefined => {
    const cut = Math.max(id.lastIndexOf("-"), id.lastIndexOf("_"), id.lastIndexOf(":"), id.lastIndexOf("."));
    return cut > 0 && cut < id.length - 1 ? id.slice(0, cut + 1) : undefined;
  };
  const shared = stem(built);
  return shared !== undefined && shared === stem(candidate);
}

/**
 * Equal links, or two links of one shape: the same origin, the same number of
 * path segments with the first one equal, and the same query keys.
 */
function sameLinkPattern(built: Element, candidate: Element): boolean {
  const a = built.getAttribute("href");
  const b = candidate.getAttribute("href");
  if (a === b) return true;
  if (!a || !b) return false;
  const base = built.baseURI || "https://row.invalid/";
  const left = parsedUrl(a, base);
  const right = parsedUrl(b, base);
  if (!left || !right || left.origin !== right.origin) return false;
  const segments = (url: URL): string[] => url.pathname.split("/").filter(Boolean);
  const [leftPath, rightPath] = [segments(left), segments(right)];
  if (leftPath.length !== rightPath.length) return false;
  if (leftPath.length > 1 && leftPath[0] !== rightPath[0]) return false;
  const keys = (url: URL): string => [...new Set(url.searchParams.keys())].sort().join("&");
  return keys(left) === keys(right);
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}
