// Reading a repeating structure into records: the page half of
// `web.dom.extract_list`.
//
// `item` selects each record's root, and `fields` maps a record field key to
// what is read inside it: `field-spec.ts` normalizes each field and
// `field-reader.ts` reads it. Every field is normalized before anything on the
// page is read, so an excluded field is never read (decision D12), and an
// `encrypt` field or a field the page cannot honour refuses the read before it
// starts. With `paginate`, the read goes on page by page through
// `pagination.ts`, which stops at the list's end, the mode's bound, or the
// command's deadline.
//
// An item already read is not read again, so a page that appends its next
// items rather than replacing them yields each item once. In `scroll` mode an
// item is its element and its content together (decision D16): a virtualised
// list that recycles a node for a new record still yields that record, while a
// node showing what it showed when read is skipped. `maxItems` bounds the
// result, and the domain's `WEB_AUTOMATION_EXTRACT_MAX_ITEMS` bounds it when the
// request names no bound.
//
// A record carries every included field: its value, or `null` for an optional
// field the page could not read. `missingFields` names every required field
// some record lacked, which is what makes the verb's validation fail instead of
// silently returning blanks. A `column` header that no header cell matches is
// missing from every record, so a page that renamed a column reports the
// rename rather than quietly returning records without it.
//
// Three conditions are not "the page differs" but "the request cannot be
// performed", so they throw and become a failed result: a `column` field on
// items that are not table rows, a pagination control followed without the
// list ever changing, and a field that resolved to a sensitive control or to
// an element inside one. The last carries an ACTION_REJECTED record, so the
// whole read is refused (decision D2).
//
// Running out of the command's `timeoutMs` is neither: the read stops, and the
// outcome says `timedOut` with the records and pages it did read (decision D5).
// Without a `timeoutMs` the read is bounded by the mode's bound and the wait
// for each page.

import { WEB_AUTOMATION_EXTRACT_MAX_ITEMS } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractListRequest } from "../types";
import { readField } from "./field-reader";
import { normalizeExtractField, type ExtractFieldReader } from "./field-spec";
import { advancePage, deadlineFor, type PaginationProgress } from "./pagination";

/** One record: each included field's value, or `null` for an optional field the page could not read. */
export type ExtractedListRecord = Record<string, string | null>;

export type ListExtractionOutcome = {
  records: ExtractedListRecord[];
  /** Pages actually read, the first included. */
  pagesRead: number;
  /** Whether `maxItems` or the pagination's bound stopped the read before the list ended. */
  truncated: boolean;
  /** Whether the command's `timeoutMs` ran out before the list ended. */
  timedOut: boolean;
  /** Required fields that at least one record did not yield. */
  missingFields: string[];
};

/** What the command adds to the request: how long the whole read may take. */
export type ListExtractionOptions = { timeoutMs?: number | undefined };

type FieldReaders = ReadonlyArray<readonly [name: string, reader: ExtractFieldReader]>;

/** One item read: its record, and the required fields it lacked. */
type ItemRead = { record: ExtractedListRecord; missing: string[] };

export async function extractList(request: WebAutomationExtractListRequest, options: ListExtractionOptions = {}): Promise<ListExtractionOutcome> {
  const item = request.item.trim();
  if (!item) throw new Error("An extract_list request needs an item selector.");
  const fields = fieldReaders(request.fields);
  const paginate = request.paginate;
  const maxItems = itemBound(request.maxItems);
  const contentAware = paginate?.mode === "scroll";

  const records: ExtractedListRecord[] = [];
  const missing = new Set<string>();
  // Every item already read, kept across pages, with its content key when
  // content counts (scroll mode) and "" when only the element does.
  const read = new Map<Element, string>();
  const keyOf = (itemRead: ItemRead): string => (contentAware ? contentKey(itemRead.record, fields) : "");
  const hasUnreadItem = (): boolean => Array.from(document.querySelectorAll(item)).some((element) => {
    const seen = read.get(element);
    return seen === undefined || (contentAware && seen !== keyOf(readRecord(element, fields)));
  });
  const progress: PaginationProgress = { item, shown: [], pagesRead: 0, scrolls: 0, deadline: deadlineFor(options.timeoutMs), hasUnreadItem };
  let truncated = false;
  let timedOut = false;

  for (;;) {
    const shown = Array.from(document.querySelectorAll(item));
    progress.shown = shown;
    progress.pagesRead += 1;
    for (const element of shown) {
      const seen = read.get(element);
      if (seen !== undefined && !contentAware) continue;
      // A new element past the bound is not read at all; a recycled one is
      // read first, because only its content says whether it is a new record.
      if (seen === undefined && records.length >= maxItems) {
        truncated = true;
        break;
      }
      const itemRead = readRecord(element, fields);
      const key = keyOf(itemRead);
      if (seen === key) continue;
      if (records.length >= maxItems) {
        truncated = true;
        break;
      }
      read.set(element, key);
      records.push(itemRead.record);
      for (const name of itemRead.missing) missing.add(name);
    }
    if (truncated || !paginate) break;

    const advance = await advancePage(paginate, progress);
    if (advance === "advanced") continue;
    truncated = advance === "truncated";
    timedOut = advance === "timed_out";
    break;
  }

  return { records, pagesRead: progress.pagesRead, truncated, timedOut, missingFields: [...missing].sort() };
}

/** The included fields' readers, in declaration order, refusing a request that names none or reads none. */
function fieldReaders(fields: WebAutomationExtractListRequest["fields"]): FieldReaders {
  const declared = Object.entries(fields);
  if (declared.length === 0) throw new Error("An extract_list request names no fields.");
  const readers = declared.flatMap(([name, field]) => {
    const reader = normalizeExtractField(name, field);
    return reader === undefined ? [] : [[name, reader] as const];
  });
  if (readers.length === 0) throw new Error("An extract_list request reads no fields: every field it names is excluded.");
  return readers;
}

/** The request's `maxItems` held to the domain's record bound, which is also the bound when it names none. */
function itemBound(requested: number | undefined): number {
  const whole = typeof requested === "number" && !Number.isNaN(requested) ? Math.trunc(requested) : WEB_AUTOMATION_EXTRACT_MAX_ITEMS;
  return Math.min(Math.max(0, whole), WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
}

function readRecord(element: Element, fields: FieldReaders): ItemRead {
  const record: ExtractedListRecord = {};
  const missing: string[] = [];
  for (const [name, reader] of fields) {
    const value = readField(element, name, reader);
    if (value === undefined) missing.push(name);
    else record[name] = value;
  }
  return { record, missing };
}

/**
 * A record's content as one comparable string: each field in declaration
 * order, as `[value]` when the record carries it and `[]` when a required
 * field was missing, so no two different records share a key.
 */
function contentKey(record: ExtractedListRecord, fields: FieldReaders): string {
  return JSON.stringify(fields.map(([name]) => (Object.prototype.hasOwnProperty.call(record, name) ? [record[name]] : [])));
}
