// The order a list read answers in, and which of its rows count as one:
// `dedupe` and `sort` of a `web.dom.extract_list` request, applied by the page.
//
// **One order, and it is the contract's** (`domain/src/actions/extraction/request.ts`):
// `where`, then `dedupe`, then `sort`, then `maxItems`. `where` is
// `item-filter.ts`'s and runs as each item is read. The rest is here, and the
// list reader asks it twice:
//
// - `identity` as each kept row is read, so a duplicate never takes a place
//   under `maxItems` and the read goes on to the next distinct row;
// - `apply` once, over every row the read answers with, which dedupes again
//   (a no-op for rows `identity` already let through, and the whole of it for
//   the rows `filtered-answer.ts` falls back to), sorts, and only then cuts to
//   `maxItems` -- so "the five newest" is the five newest of every row read,
//   not the newest of the first five.
//
// **Until 2026-09-28 a request could say both and the page did neither.** The
// domain read them, validated them and named them in the catalog; nothing here
// looked at them, so a repair that wrote "newest first" got page order back,
// saw an unchanged answer and stopped as not converging
// (`docs/working/language-driven-flow-loop-plan/reports/inflight-audit-0928.md`).
//
// **A value that cannot be read sorts last, and is counted.** A row whose value
// for a key is absent, or does not state that key's type, goes after every row
// that does, whichever the direction, and ties among such rows fall to the next
// key and then to page order. `unsortable` counts the rows with at least one
// such key, so a sort over a column the page states as prose is visible as one
// rather than looking like page order that happened to be right.
//
// A number is read by the rule a `where` bound reads one by
// (`webAutomationExtractConditionNumber`): the first run of digits, thousands
// separators dropped, so `$1,299.00` is 1299 and `£65,000 to £80,000` is 65000.
//
// `auto` reads a column as dates when most of its values state one, as numbers
// when most state one, and as text otherwise, deciding once per key over the
// rows being sorted. A date may be relative to the read -- "3 days ago", "30+
// days ago", "yesterday" -- because that is how a listing says when it was
// posted, and "newest first" over such a column is the case this was built for
// (`run-mulwm2dc-0bd95f22`).

import { webAutomationExtractConditionNumber } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractListRequest } from "../types";

type Row = Readonly<Record<string, string | null>>;
type SortKey = NonNullable<WebAutomationExtractListRequest["sort"]>[number];
type Comparable = number | string;

/** What `dedupe` and `sort` did to a read, in counts alone; `0` for the half the request did not name. */
export type ListExtractionOrderReport = { duplicates: number; unsortable: number };

/** The rows in answer order, cut to the bound, and what that took. */
export type OrderedRows<T extends Row> = { rows: T[]; duplicates: number; unsortable: number; cut: boolean };

/** A request's dedupe and sort, bound to the columns the read actually reads. */
export type ListRowOrder = {
  /** Whether the request sorts, which makes `maxItems` a bound on the answer rather than on the read. */
  sorts: boolean;
  /** The row's dedupe identity, or `undefined` for a request that dedupes nothing and for a row that cannot be identified. */
  identity(row: Row): string | undefined;
  /** Dedupe, sort, then cut to `bound`. */
  apply<T extends Row>(rows: readonly T[], bound: number, now?: number): OrderedRows<T>;
};

/**
 * The order a request asks for, over the columns the read reads (`fieldNames`,
 * excluded fields left out), or `undefined` for a request that names neither
 * `dedupe` nor `sort` -- or names only columns the read does not read, which
 * the domain's reader already resolved away and this refuses to guess at.
 */
export function listRowOrderFor(request: Pick<WebAutomationExtractListRequest, "dedupe" | "sort">, fieldNames: readonly string[]): ListRowOrder | undefined {
  const readable = new Set(fieldNames);
  const by = request.dedupe === undefined ? undefined : unique(request.dedupe.by.filter((name) => readable.has(name)));
  // A dedupe whose every column is gone still means "list each once", so it
  // falls back to the whole row rather than to nothing, as the domain's reader
  // does for a dedupe that names no column at all.
  const dedupeBy = by === undefined ? undefined : by.length > 0 ? by : [...fieldNames];
  const sort = (request.sort ?? []).filter((key) => readable.has(key.field));
  if (dedupeBy === undefined && sort.length === 0) return undefined;
  const identity = (row: Row): string | undefined => (dedupeBy === undefined ? undefined : identityOf(row, dedupeBy));
  return {
    sorts: sort.length > 0,
    identity,
    apply<T extends Row>(rows: readonly T[], bound: number, now: number = Date.now()): OrderedRows<T> {
      const seen = new Set<string>();
      let duplicates = 0;
      const distinct = rows.filter((row) => {
        const id = identity(row);
        if (id === undefined) return true;
        if (seen.has(id)) {
          duplicates += 1;
          return false;
        }
        seen.add(id);
        return true;
      });
      const { rows: sorted, unsortable } = sort.length > 0 ? sortRows(distinct, sort, now) : { rows: distinct, unsortable: 0 };
      const limit = Math.max(0, bound);
      return { rows: sorted.slice(0, limit), duplicates, unsortable, cut: sorted.length > limit };
    }
  };
}

/**
 * A row's values under the dedupe columns, compared with layout and case
 * ignored, or `undefined` when it has none of them: a row that cannot be
 * identified is never a duplicate, since folding every such row into one would
 * drop rows that differ in everything else.
 */
function identityOf(row: Row, by: readonly string[]): string | undefined {
  const values = by.map((name) => {
    const value = Object.prototype.hasOwnProperty.call(row, name) ? row[name] : undefined;
    return typeof value === "string" ? collapsed(value).toLowerCase() : "";
  });
  return values.every((value) => value === "") ? undefined : JSON.stringify(values);
}

/** The rows by each key in turn and then page order, readable values first, and how many rows had a key they could not be read by. */
function sortRows<T extends Row>(rows: readonly T[], keys: readonly SortKey[], now: number): { rows: T[]; unsortable: number } {
  const readers = keys.map((key) => ({ key, read: readerFor(key, rows, now) }));
  const decorated = rows.map((row, index) => ({ row, index, values: readers.map(({ key, read }) => read(valueOf(row, key.field))) }));
  const unsortable = decorated.filter((entry) => entry.values.some((value) => value === undefined)).length;
  decorated.sort((a, b) => {
    for (const [position, { key }] of readers.entries()) {
      const left = a.values[position];
      const right = b.values[position];
      if (left === undefined || right === undefined) {
        if (left === right) continue;
        return left === undefined ? 1 : -1;
      }
      const compared = compare(left, right);
      if (compared !== 0) return key.order === "desc" ? -compared : compared;
    }
    return a.index - b.index;
  });
  return { rows: decorated.map((entry) => entry.row), unsortable };
}

function valueOf(row: Row, field: string): string | undefined {
  const value = Object.prototype.hasOwnProperty.call(row, field) ? row[field] : undefined;
  return typeof value === "string" && collapsed(value) !== "" ? value : undefined;
}

type Reader = (value: string | undefined) => Comparable | undefined;

/** How one key's values are read: as its declared type, or, for `auto`, as the type most of the column's values state. */
function readerFor(key: SortKey, rows: readonly Row[], now: number): Reader {
  const asDate: Reader = (value) => (value === undefined ? undefined : dateValue(value, now));
  const asNumber: Reader = (value) => (value === undefined ? undefined : webAutomationExtractConditionNumber(value));
  const asText: Reader = (value) => (value === undefined ? undefined : collapsed(value));
  const type = key.as ?? "auto";
  if (type === "date") return asDate;
  if (type === "number") return asNumber;
  if (type === "text") return asText;
  const present = rows.flatMap((row) => valueOf(row, key.field) ?? []);
  if (present.length === 0) return asText;
  const most = (read: Reader): boolean => present.filter((value) => read(value) !== undefined).length * 2 > present.length;
  if (most(asDate)) return asDate;
  if (most(asNumber)) return asNumber;
  return asText;
}

const COLLATOR = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function compare(left: Comparable, right: Comparable): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return COLLATOR.compare(String(left), String(right));
}

const DAY_MS = 86_400_000;

/** Milliseconds per unit of a relative date, by every spelling a listing uses for it. */
const UNIT_MS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:seconds?|secs?|s)$/u, 1_000],
  [/^(?:minutes?|mins?)$/u, 60_000],
  [/^(?:hours?|hrs?|h)$/u, 3_600_000],
  [/^(?:days?|d)$/u, DAY_MS],
  [/^(?:weeks?|wks?|w)$/u, 7 * DAY_MS],
  [/^(?:months?|mos?)$/u, 30 * DAY_MS],
  [/^(?:years?|yrs?|y)$/u, 365 * DAY_MS]
];

const RELATIVE = /\b(\d+(?:\.\d+)?|an?|one)\+?\s*(seconds?|secs?|s|minutes?|mins?|hours?|hrs?|h|days?|d|weeks?|wks?|w|months?|mos?|years?|yrs?|y)\s+ago\b/iu;
// Whole values only: "today" and "new" are words a title or a company name uses
// too, and "Apply today" is not a date.
const NOW_WORDS = /^(?:(?:posted|active|updated)\s+)?(?:just now|just posted|right now|today|now)$/iu;
const YESTERDAY = /^(?:(?:posted|active|updated)\s+)?yesterday$/iu;
const ISO = /\b(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/u;
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?(?:\\s+(\\d{4}))?\\b`, "iu");
const MONTH_DAY = new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "iu");
const NUMERIC = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/u;

/**
 * The instant a value states, as milliseconds, or `undefined` for a value that
 * states no date. Relative dates are measured back from `now`, which is one
 * instant for a whole sort so every row is measured from the same place.
 */
function dateValue(text: string, now: number): number | undefined {
  const relative = RELATIVE.exec(text);
  if (relative !== null) {
    const amount = /^\d/u.test(relative[1]!) ? Number(relative[1]) : 1;
    const unit = relative[2]!.toLowerCase();
    const ms = UNIT_MS.find(([pattern]) => pattern.test(unit))?.[1];
    return ms === undefined ? undefined : now - amount * ms;
  }
  const whole = collapsed(text);
  if (YESTERDAY.test(whole)) return now - DAY_MS;
  const iso = ISO.exec(text);
  if (iso !== null) return utc(Number(iso[1]), Number(iso[2]), Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0));
  const dayMonth = DAY_MONTH.exec(text);
  if (dayMonth !== null) return withYear(dayMonth[3], monthOf(dayMonth[2]!), Number(dayMonth[1]), now);
  const monthDay = MONTH_DAY.exec(text);
  if (monthDay !== null) return withYear(monthDay[3], monthOf(monthDay[1]!), Number(monthDay[2]), now);
  const numeric = NUMERIC.exec(text);
  if (numeric !== null) {
    // Day first where the first number cannot be a month, month first otherwise.
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    return first > 12 ? utc(Number(numeric[3]), second, first) : utc(Number(numeric[3]), first, second);
  }
  if (NOW_WORDS.test(whole)) return now;
  return undefined;
}

/** A month and day with the year written, or, with none, the latest such date not after the read. */
function withYear(year: string | undefined, month: number, day: number, now: number): number | undefined {
  if (year !== undefined) return utc(Number(year), month, day);
  const thisYear = new Date(now).getUTCFullYear();
  const date = utc(thisYear, month, day);
  if (date === undefined) return undefined;
  return date > now + DAY_MS ? utc(thisYear - 1, month, day) : date;
}

function utc(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0): number | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const time = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  return Number.isFinite(time) ? time : undefined;
}

function monthOf(word: string): number {
  return ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(word.slice(0, 3).toLowerCase()) + 1;
}

/** The value's text with its layout removed: a card writes for a screen, not for a comparison. */
function collapsed(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
