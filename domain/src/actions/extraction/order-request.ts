// Reading a list request's `dedupe` and `sort` off an untrusted value.
//
// Both are written by a model, usually on a first attempt and usually in
// whatever shape the instruction's words suggested, so both are read
// forgivingly: `dedupe: true`, `dedupe: "url"`, `dedupe: ["title", "company"]`
// and `dedupe: {by: "url"}` all say something, as do `sort: "posted desc"`,
// `sort: "-price"`, `sort: {price: "asc"}` and `sort: [{field: "salary", order:
// "desc", as: "number"}]`. Core's parameter normalisation makes a lone value a
// list of one for these node parameters, so `[true]` and `["posted desc"]` are
// read as their only item.
//
// **A column is resolved, not matched.** Each name goes through the same
// nearest-column rule as a `where` condition (`./field-match.ts`), so a key in
// another casing or slightly misspelled is the column it plainly means.
//
// **`dedupe` never fails to say something.** A dedupe whose every column is
// unknown still means "list each once", so it keeps the default key rather than
// being dropped; only a value that is not a dedupe at all -- a number, an object
// of foreign keys -- is refused. The default key is the whole record: every
// column the read reads. That is Core's default identity for the rows a run
// collects (a record output's `process` with no `dedupe`), so the page's own
// dedupe in exploration folds exactly the rows the stored answer will; until
// read-list S1 it was the list's link column, which folded rows that shared a
// link and differed in everything else.
//
// **A sort key that cannot be read is dropped on its own**, by position, and the
// keys beside it still sort. Dropping a key widens nothing and narrows nothing:
// the rows are the same rows in a less specific order.

import type { JsonObject } from "fluxiq/core";
import { isWebAutomationExtractFieldRead, webAutomationExtractFieldMatch } from "./field-match";
import {
  WEB_AUTOMATION_EXTRACT_MAX_SORT_KEYS,
  type WebAutomationExtractField,
  type WebAutomationExtractListDedupe,
  type WebAutomationExtractListSortKey,
  type WebAutomationExtractSortOrder,
  type WebAutomationExtractSortType
} from "./request";

type Fields = Record<string, WebAutomationExtractField>;

/** The dedupe a value asks for, none, or `refused` for a value that is not a dedupe at all. */
export function webAutomationExtractListDedupeValue(value: unknown, fields: Fields): { dedupe?: WebAutomationExtractListDedupe | undefined; refused: boolean } {
  const written = dedupeColumns(value);
  if (written === REFUSED) return { refused: true };
  if (written === NONE) return { refused: false };
  const readable = readableKeys(fields);
  if (readable.length === 0) return { refused: false };
  const resolved = unique(written.flatMap((name) => resolvedColumn(name, fields) ?? []));
  return { dedupe: { by: resolved.length > 0 ? resolved : [...readable] }, refused: false };
}

/** The sort keys a value asks for, and the positions of the keys that could not be read. */
export function webAutomationExtractListSortValue(value: unknown, fields: Fields): { sort: WebAutomationExtractListSortKey[]; refused: number[] } {
  const entries = sortEntries(value);
  if (entries === REFUSED) return { sort: [], refused: [0] };
  const sort: WebAutomationExtractListSortKey[] = [];
  const refused: number[] = [];
  for (const [index, entry] of entries.entries()) {
    const key = sortKey(entry, fields);
    if (key === undefined || sort.length >= WEB_AUTOMATION_EXTRACT_MAX_SORT_KEYS || sort.some((kept) => kept.field === key.field)) refused.push(index);
    else sort.push(key);
  }
  return { sort, refused };
}

const REFUSED = Symbol("refused");
const NONE = Symbol("none");

/** The column names a dedupe names, `[]` for "the default key", `NONE` for no dedupe, or `REFUSED`. */
function dedupeColumns(value: unknown): string[] | typeof NONE | typeof REFUSED {
  const only = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (only === null || only === false) return NONE;
  if (Array.isArray(only)) {
    if (only.length === 0) return NONE;
    const names = only.flatMap((entry) => (typeof entry === "string" ? splitNames(entry) : isObject(entry) ? namesIn(entry) ?? [] : []));
    return names.length > 0 ? names : REFUSED;
  }
  if (only === true) return [];
  if (typeof only === "string") {
    const word = only.trim().toLowerCase();
    if (OFF_WORDS.has(word)) return NONE;
    if (word === "" || ON_WORDS.has(word)) return [];
    return splitNames(only);
  }
  if (isObject(only)) {
    if (Object.keys(only).length === 0) return [];
    const by = DEDUPE_KEYS.map((key) => only[key]).find((entry) => entry !== undefined);
    if (by === undefined) return REFUSED;
    return dedupeColumns(by);
  }
  return REFUSED;
}

/** The names under an object's own naming key, as a dedupe or sort entry writes it. */
function namesIn(entry: JsonObject): string[] | undefined {
  const named = FIELD_KEYS.map((key) => entry[key]).find((value) => typeof value === "string");
  return typeof named === "string" ? splitNames(named) : undefined;
}

function splitNames(text: string): string[] {
  return text.split(/\s*[,+&]\s*|\s+and\s+/u).map((name) => name.trim()).filter(Boolean);
}

/** The keys a dedupe object names its columns under. */
const DEDUPE_KEYS = ["by", "field", "fields", "column", "columns", "key", "keys", "on"] as const;
const ON_WORDS: ReadonlySet<string> = new Set(["true", "yes", "on", "auto", "default", "once", "unique"]);
const OFF_WORDS: ReadonlySet<string> = new Set(["false", "no", "off", "none"]);

/** The sort as a list of written keys, each still to be read, or `REFUSED`. */
function sortEntries(value: unknown): unknown[] | typeof REFUSED {
  if (value === null || value === false) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => (typeof entry === "string" ? splitKeys(entry) : [entry]));
  if (typeof value === "string") return splitKeys(value);
  if (isObject(value)) return [value];
  return REFUSED;
}

function splitKeys(text: string): string[] {
  return text.split(/\s*[,;]\s*|\s+then\s+/u).map((part) => part.trim()).filter(Boolean);
}

/** One key, read from its written form and resolved against the request's columns. */
function sortKey(entry: unknown, fields: Fields): WebAutomationExtractListSortKey | undefined {
  const written = writtenSortKey(entry);
  if (written === undefined) return undefined;
  const field = resolvedColumn(written.name, fields);
  if (field === undefined) return undefined;
  return { field, order: written.order, ...(written.as !== undefined && written.as !== "auto" ? { as: written.as } : {}) };
}

type WrittenSortKey = { name: string; order: WebAutomationExtractSortOrder; as?: WebAutomationExtractSortType | undefined };

function writtenSortKey(entry: unknown): WrittenSortKey | undefined {
  if (typeof entry === "string") return sortKeyFromWords(entry);
  if (!isObject(entry)) return undefined;
  const name = FIELD_KEYS.map((key) => entry[key]).find((value) => typeof value === "string" && value.trim() !== "");
  if (typeof name === "string") {
    const orderWord = ORDER_KEYS.map((key) => entry[key]).find((value) => value !== undefined);
    const typeWord = TYPE_KEYS.map((key) => entry[key]).find((value) => value !== undefined);
    const order = orderWord === undefined ? "asc" : orderOf(orderWord);
    const as = typeWord === undefined ? undefined : typeOf(typeWord);
    if (order === undefined || (typeWord !== undefined && as === undefined)) return undefined;
    return { name: name.trim(), order, ...(as !== undefined ? { as } : {}) };
  }
  // `{price: "desc"}`: one column, named as the key, with its direction as the value.
  const pairs = Object.entries(entry);
  if (pairs.length !== 1) return undefined;
  const [column, words] = pairs[0]!;
  if (typeof words !== "string" && typeof words !== "number" && typeof words !== "boolean") return undefined;
  return sortKeyFromWords(`${column} ${words === 1 || words === true ? "asc" : words === -1 || words === false ? "desc" : String(words)}`);
}

/** `posted desc`, `-price`, `price:desc`, `salary desc number`: the column first, then any direction and type words. */
function sortKeyFromWords(text: string): WrittenSortKey | undefined {
  let rest = text.trim();
  let order: WebAutomationExtractSortOrder | undefined;
  if (rest.startsWith("-")) { order = "desc"; rest = rest.slice(1); } else if (rest.startsWith("+")) { order = "asc"; rest = rest.slice(1); }
  const [name, ...words] = rest.split(/[\s:]+/u).filter(Boolean);
  // A direction with no column -- `"newest"` -- names nothing to sort by, and
  // resolving the word as the nearest column would sort by whatever it resembled.
  if (name === undefined || orderOf(name) !== undefined) return undefined;
  let as: WebAutomationExtractSortType | undefined;
  for (const word of words) {
    const readOrder = orderOf(word);
    const readType = readOrder === undefined ? typeOf(word) : undefined;
    if (readOrder !== undefined) order = readOrder;
    else if (readType !== undefined) as = readType;
    else if (!FILLER_WORDS.has(word.toLowerCase())) return undefined;
  }
  return { name, order: order ?? "asc", ...(as !== undefined ? { as } : {}) };
}

function orderOf(value: unknown): WebAutomationExtractSortOrder | undefined {
  if (value === 1 || value === true) return "asc";
  if (value === -1 || value === false) return "desc";
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  if (ASCENDING.has(word)) return "asc";
  if (DESCENDING.has(word)) return "desc";
  return undefined;
}

function typeOf(value: unknown): WebAutomationExtractSortType | undefined {
  if (typeof value !== "string") return undefined;
  return TYPE_WORDS.get(value.trim().toLowerCase());
}

const FIELD_KEYS = ["field", "by", "column", "key", "name", "on"] as const;
const ORDER_KEYS = ["order", "direction", "dir", "sort"] as const;
const TYPE_KEYS = ["as", "type", "kind"] as const;
const ASCENDING: ReadonlySet<string> = new Set([
  "asc", "ascending", "up", "increasing", "low", "lowest", "cheapest", "oldest", "earliest", "smallest", "least", "fewest", "a-z", "low-high", "min"
]);
const DESCENDING: ReadonlySet<string> = new Set([
  "desc", "descending", "down", "decreasing", "high", "highest", "newest", "latest", "recent", "most", "largest", "biggest", "dearest", "z-a", "high-low", "max"
]);
const TYPE_WORDS: ReadonlyMap<string, WebAutomationExtractSortType> = new Map([
  ["auto", "auto"],
  ["number", "number"], ["numeric", "number"], ["num", "number"], ["amount", "number"], ["price", "number"], ["money", "number"], ["count", "number"],
  ["date", "date"], ["time", "date"], ["datetime", "date"], ["timestamp", "date"],
  ["text", "text"], ["string", "text"], ["alpha", "text"], ["alphabetical", "text"], ["alphabetic", "text"]
]);
const FILLER_WORDS: ReadonlySet<string> = new Set(["first", "order", "by", "as"]);

/** The column a written name means, among the columns the request actually reads, or `undefined`. */
function resolvedColumn(name: string, fields: Fields): string | undefined {
  return webAutomationExtractFieldMatch(name, fields, {})?.field;
}

function readableKeys(fields: Fields): string[] {
  return Object.keys(fields).filter((key) => isWebAutomationExtractFieldRead(fields[key]));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
