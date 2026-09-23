// Reading a repeating structure into records: the page half of
// `web.dom.extract_list`.
//
// `item` selects each record's root, `where` says which of those items are
// records at all (`item-filter.ts`), and `fields` maps a record field key to
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
// The two modes that move to another page -- `next` and `numbered` -- also
// leave out a record that repeats one an earlier page already yielded, field
// for field. An element cannot say that: a page replaced in place, or loaded
// as a new document, shows only new elements, so the listing a search's index
// shifted onto the top of the next page would otherwise be read twice, and
// only when the page happened to be replaced rather than reloaded. Two equal
// records on the same page are still two records, as the page shows them.
//
// A read can outlive its document. With a `checkpoint`, the records and pages
// read so far are handed over, and awaited, before each control is followed;
// with `resume`, a new document goes on from such a checkpoint -- its records
// count toward the bound, its pages toward `maxPages`, and in every mode none
// of its records is read again, since a new document can only show them as new
// elements -- after waiting for the page to show its records
// (`page-render.ts`). The worker's side of that is
// `runtime/extract-list-continuation.ts`.
//
// An item a `where` condition rejects is not a record and never becomes one:
// it is left out of the records, it does not count toward `maxItems`, and a
// required field it lacks is not reported missing, because the request never
// asked to read it. `filtered` counts them, so a read says how much of the run
// it left out rather than only how much it kept.
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
import type { ExtractionCheckpoint } from "../../shared/extraction-continuation";
import type { WebAutomationExtractListPagination, WebAutomationExtractListRequest } from "../types";
import { readField } from "./field-reader";
import { normalizeExtractField, type ExtractFieldReader } from "./field-spec";
import { itemFilterFor } from "./item-filter";
import { awaitListPresent, awaitPageRendered } from "./page-render";
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
  /** Items of the run that a `where` condition left out, so they are not records (C5). */
  filtered: number;
};

/**
 * What the command adds to the request: how long the whole read may take, and,
 * when the worker carries the read across documents, where it goes on from and
 * where it hands its progress.
 */
export type ListExtractionOptions = {
  timeoutMs?: number | undefined;
  /** The read another document began, which this one continues. */
  resume?: ExtractionCheckpoint | undefined;
  /** Takes the read so far before each control is followed; the control is followed once it resolves. */
  checkpoint?: ((progress: ExtractionCheckpoint) => Promise<void>) | undefined;
};

type FieldReaders = ReadonlyArray<readonly [name: string, reader: ExtractFieldReader]>;

/** One item read: its record, and the required fields it lacked. */
type ItemRead = { record: ExtractedListRecord; missing: string[] };

export async function extractList(request: WebAutomationExtractListRequest, options: ListExtractionOptions = {}): Promise<ListExtractionOutcome> {
  const item = request.item.trim();
  if (!item) throw new Error("An extract_list request needs an item selector.");
  const fields = fieldReaders(request.fields);
  // Before anything on the page is read, as every field is: a condition the
  // page cannot honour refuses the read rather than emptying a list midway.
  const keeps = itemFilterFor(request);
  const paginate = request.paginate;
  const maxItems = itemBound(request.maxItems);
  const contentAware = paginate?.mode === "scroll";
  const resume = options.resume;

  const records: ExtractedListRecord[] = resume ? resume.records.map((record) => ({ ...record })) : [];
  const missing = new Set<string>(resume?.missingFields ?? []);
  // Every item already read, kept across pages, with its content key when
  // content counts (scroll mode) and "" when only the element does.
  const read = new Map<Element, string>();
  // The content of every record that must not be read again: each record an
  // earlier page yielded, in the modes that move to another page, and in every
  // mode each record a continued read carried here from another document.
  const pageByPage = movesToAnotherPage(paginate);
  const earlierPages = pageByPage || resume ? new Set(records.map((record) => contentKey(record, fields))) : undefined;
  const keyOf = (itemRead: ItemRead): string => (contentAware ? contentKey(itemRead.record, fields) : "");
  const hasUnreadItem = (): boolean => Array.from(document.querySelectorAll(item)).some((element) => {
    const seen = read.get(element);
    return seen === undefined || (contentAware && seen !== keyOf(readRecord(element, fields)));
  });
  const progress: PaginationProgress = {
    item,
    shown: [],
    pagesRead: resume?.pagesRead ?? 0,
    scrolls: resume?.scrolls ?? 0,
    deadline: deadlineFor(options.timeoutMs),
    hasUnreadItem
  };
  const checkpoint = options.checkpoint;
  if (checkpoint) {
    progress.beforeFollow = () => checkpoint({
      records: records.map((record) => ({ ...record })),
      pagesRead: progress.pagesRead,
      scrolls: progress.scrolls,
      missingFields: [...missing].sort(),
      filtered
    });
  }
  let truncated = false;
  let timedOut = false;
  let filtered = resume?.filtered ?? 0;

  // A document continuing a read was reached by the control the last one
  // followed, so it is waited on as that control's page would have been.
  if (resume && paginate && await awaitPageRendered(paginate, progress) === "timed_out") {
    return { records, pagesRead: progress.pagesRead, truncated, timedOut: true, missingFields: [...missing].sort(), filtered };
  }
  // The page this read starts on gets the same wait as every page it moves to
  // (`page-render.ts`): a read dispatched at a page still rendering its list
  // used to read the empty one and report it as a clean read of nothing. It is
  // a ceiling, not a sleep -- a page that already holds its items is read at
  // once -- and what it waits for is what the request said the page must hold.
  if (!resume) {
    // A paginated read waits only for its first item: the rest may legitimately
    // be on a later page, and `pagination.ts` already waits for each of those.
    const required = requiredItems(request.minItems);
    await awaitListPresent(item, paginate ? Math.min(1, required) : required, paginate === undefined, progress);
  }

  for (;;) {
    const shown = Array.from(document.querySelectorAll(item));
    progress.shown = shown;
    progress.pagesRead += 1;
    const thisPage: string[] = [];
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
      // An item a condition rejects is not a record: it is remembered as read
      // so a growing list still knows it has been looked at, and nothing else
      // about it -- not its content, not the fields it lacked -- is kept.
      if (keeps && !keeps(element, itemRead.record)) {
        if (seen === undefined) filtered += 1;
        read.set(element, key);
        continue;
      }
      const content = earlierPages ? contentKey(itemRead.record, fields) : "";
      if (earlierPages?.has(content)) {
        read.set(element, key);
        continue;
      }
      if (records.length >= maxItems) {
        truncated = true;
        break;
      }
      read.set(element, key);
      records.push(itemRead.record);
      thisPage.push(content);
      for (const name of itemRead.missing) missing.add(name);
    }
    if (pageByPage) for (const content of thisPage) earlierPages?.add(content);
    if (truncated || !paginate) break;

    const advance = await advancePage(paginate, progress);
    if (advance === "advanced") continue;
    truncated = advance === "truncated";
    timedOut = advance === "timed_out";
    break;
  }

  return { records, pagesRead: progress.pagesRead, truncated, timedOut, missingFields: [...missing].sort(), filtered };
}

/** Whether the read moves from page to page -- replaced in place or loaded anew -- rather than growing one list. */
function movesToAnotherPage(paginate: WebAutomationExtractListPagination | undefined): boolean {
  return paginate !== undefined && (paginate.mode === undefined || paginate.mode === "next" || paginate.mode === "numbered");
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

/**
 * How many items the request says the page must hold, which is what the first
 * read waits for. It is `extract-list.ts`'s own `minItems` rule -- 1 when the
 * request names none, so a list that matched nothing is not a success -- read
 * here so the wait and the post-condition cannot disagree.
 */
function requiredItems(requested: number | undefined): number {
  return typeof requested === "number" && Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 1;
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
