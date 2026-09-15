// Reading a repeating structure into records.
//
// `item` selects each record's root; `fields` maps a field name to a selector
// inside it, in the scenario contract's forms: a plain selector reads text, an
// empty one reads the item itself, `selector@attribute` reads an attribute, and
// `column:<header text>` reads the cell under that header when the items are
// table rows, so extraction survives a column reorder. With `paginate`, the
// `next` control is followed until it is absent or `maxPages` pages have been
// read, waiting for the list to change after each page rather than for a fixed
// delay. An item already read on an earlier page is not read again, so a page
// that appends its next items rather than replacing them yields each item once.
// `maxItems` bounds the result, and `EXTRACT_MAX_ITEMS` bounds it when the
// request names no bound.
//
// `missingFields` names every declared field that some record lacked, which is
// what makes the verb's validation fail instead of silently returning blanks. A
// `column:` header that no header cell matches is missing from every record, so
// it lands there too: a page that renamed a column reports the rename rather
// than quietly returning records without that field.
//
// Three conditions are not "the page differs" but "the request cannot be
// performed", so they throw and become a failed result: a `column:` field on
// items that are not table rows, a `next` control that was followed without
// the list ever changing, and a field that resolved to a sensitive control. The
// last carries an ACTION_REJECTED record, so the whole read is refused rather
// than returned without that field (decision D2); the record names the
// author's field and quotes no value. A text field or column that is a
// container skips the contents of sensitive controls inside it, as
// `readableText` does for the extract verb.
//
// Running out of the command's `timeoutMs` is neither: the read stops, and the
// outcome says `timedOut` with the records and pages it did read (decision D5).
// Without a `timeoutMs` the read is bounded only by `maxPages` and the wait for
// each page to change.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { isSensitiveFormControl } from "../element-traits";
import type { WebAutomationExtractListRequest } from "../types";
import { readableText } from "./extract";

export type ExtractedListRecord = Record<string, string>;

export type ListExtractionOutcome = {
  records: ExtractedListRecord[];
  /** Pages actually read, the first included. */
  pagesRead: number;
  /** Whether `maxItems` or `maxPages` stopped the read before the list ended. */
  truncated: boolean;
  /** Whether the command's `timeoutMs` ran out before the list ended. */
  timedOut: boolean;
  /** Declared fields that at least one record did not yield. */
  missingFields: string[];
};

/** What the command adds to the request: how long the whole read may take. */
export type ListExtractionOptions = { timeoutMs?: number | undefined };

/**
 * The upper bound on pages one extraction may follow, mirroring the domain's
 * `WEB_AUTOMATION_EXTRACT_MAX_PAGES`. It is restated as a number because the
 * content script must not import the domain's runtime: a value import would
 * pull the domain barrel into the page bundle.
 * `tests/list-extraction.test.ts` asserts the two agree.
 */
export const EXTRACT_MAX_PAGES = 50;

/**
 * The upper bound on records one extraction may return, across every page, and
 * the bound a request that names none is held to. It mirrors the domain's
 * `WEB_AUTOMATION_EXTRACT_MAX_ITEMS` for the reason `EXTRACT_MAX_PAGES` does,
 * and the same test asserts the two agree.
 */
export const EXTRACT_MAX_ITEMS = 1_000;

/** How long the list has to change after the `next` control was followed. */
const LIST_CHANGE_TIMEOUT_MS = 10_000;
const LIST_CHANGE_POLL_MS = 25;

const COLUMN_PREFIX = "column:";
const ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_:.]*$/u;

/** One field's specification: a table column, or an element inside the item read as text or as one attribute. */
type ExtractField =
  | { kind: "column"; header: string }
  | { kind: "element"; selector?: string; attribute?: string };

type ParsedField = readonly [name: string, field: ExtractField];

/** What the wait after following `next` saw: a new list, no change in time, or the command's deadline. */
type ListChange = "changed" | "unchanged" | "timed_out";

/**
 * Reads one field specification. An `@` only introduces an attribute when what
 * follows is a valid attribute name, so a selector that contains one --
 * `[data-owner="a@b"]` -- stays a selector.
 */
export function parseExtractField(spec: string): ExtractField {
  if (spec.startsWith(COLUMN_PREFIX)) {
    const header = normalizeText(spec.slice(COLUMN_PREFIX.length));
    if (!header) throw new Error(`The extract_list field ${JSON.stringify(spec)} names no column header.`);
    return { kind: "column", header };
  }
  const at = spec.lastIndexOf("@");
  const candidate = at < 0 ? "" : spec.slice(at + 1);
  const attribute = ATTRIBUTE_NAME.test(candidate) ? candidate : undefined;
  const selector = (attribute === undefined ? spec : spec.slice(0, at)).trim();
  return {
    kind: "element",
    ...(selector ? { selector } : {}),
    ...(attribute === undefined ? {} : { attribute })
  };
}

export async function extractList(request: WebAutomationExtractListRequest, options: ListExtractionOptions = {}): Promise<ListExtractionOutcome> {
  const item = request.item.trim();
  if (!item) throw new Error("An extract_list request needs an item selector.");
  const fields: ParsedField[] = Object.entries(request.fields).map(([name, spec]) => [name, parseExtractField(spec)] as const);
  if (fields.length === 0) throw new Error("An extract_list request names no fields.");
  const maxPages = request.paginate ? Math.min(Math.max(1, Math.trunc(request.paginate.maxPages)), EXTRACT_MAX_PAGES) : 1;
  const maxItems = Math.min(Math.max(0, Math.trunc(request.maxItems ?? EXTRACT_MAX_ITEMS)), EXTRACT_MAX_ITEMS);
  const deadline = deadlineFor(options.timeoutMs);

  const records: ExtractedListRecord[] = [];
  const missing = new Set<string>();
  // Every item already read, kept across pages: a page that appends shows its
  // earlier items again, and they are not new records.
  const read = new Set<Element>();
  let pagesRead = 0;
  let truncated = false;
  let timedOut = false;

  for (;;) {
    const items = Array.from(document.querySelectorAll(item));
    pagesRead += 1;
    for (const element of items) {
      if (read.has(element)) continue;
      if (records.length >= maxItems) {
        truncated = true;
        break;
      }
      read.add(element);
      records.push(readRecord(element, fields, missing));
    }
    if (truncated) break;

    const paginate = request.paginate;
    const next = paginate ? document.querySelector(paginate.next) : null;
    // No next control is the list ending, which is not truncation; stopping at
    // maxPages while one is still there is.
    if (!paginate || !next) break;
    if (pagesRead >= maxPages) {
      truncated = true;
      break;
    }
    if (!(next instanceof HTMLElement)) throw new Error(`The pagination control ${JSON.stringify(paginate.next)} is not a clickable element.`);
    if (deadline !== undefined && Date.now() >= deadline) {
      timedOut = true;
      break;
    }
    next.click();
    const change = await waitForListChange(item, items, deadline);
    if (change === "timed_out") {
      timedOut = true;
      break;
    }
    if (change === "unchanged") {
      throw new Error(`The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of following ${JSON.stringify(paginate.next)} to page ${pagesRead + 1}.`);
    }
  }

  return { records, pagesRead, truncated, timedOut, missingFields: [...missing].sort() };
}

/** When the whole read must stop, or `undefined` when the command set no positive `timeoutMs`. */
function deadlineFor(timeoutMs: number | undefined): number | undefined {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? Date.now() + timeoutMs : undefined;
}

function readRecord(item: Element, fields: readonly ParsedField[], missing: Set<string>): ExtractedListRecord {
  const record: ExtractedListRecord = {};
  for (const [name, field] of fields) {
    const value = readField(item, name, field);
    if (value === undefined) missing.add(name);
    else record[name] = value;
  }
  return record;
}

function readField(item: Element, name: string, field: ExtractField): string | undefined {
  if (field.kind === "column") return readColumn(item, name, field.header);
  const element = field.selector ? item.querySelector(field.selector) : item;
  if (!element) return undefined;
  if (isSensitiveFormControl(element)) throw sensitiveFieldRefusal(name);
  if (field.attribute !== undefined) return element.getAttribute(field.attribute) ?? undefined;
  return readableText(element);
}

/**
 * The cell under `header` in this row. Cells are matched by position among
 * their row's cells, which is what survives a column reorder; colspan is not
 * modelled. A header no cell matches yields nothing, so the field is reported
 * missing rather than read from the wrong column.
 */
function readColumn(item: Element, name: string, header: string): string | undefined {
  const row = item as HTMLTableRowElement;
  const table = row.tagName === "TR" ? row.closest("table") : null;
  if (!table) throw new Error("A column field needs extract_list items that are table rows.");
  const headerRow = table.tHead?.rows[0]
    ?? Array.from(table.rows).find((candidate) => Array.from(candidate.cells).some((cell) => cell.tagName === "TH"));
  const index = headerRow
    ? Array.from(headerRow.cells).findIndex((cell) => normalizeText(cell.textContent ?? "") === header)
    : -1;
  if (index < 0) return undefined;
  const cell = row.cells[index];
  if (!cell) return undefined;
  if (isSensitiveFormControl(cell)) throw sensitiveFieldRefusal(name);
  return readableText(cell);
}

/**
 * The refusal for a field that resolved to a sensitive control. It names the
 * field, which the author declared, and never the value; `actionFailure` lifts
 * the record, so the whole action is refused as ACTION_REJECTED.
 */
function sensitiveFieldRefusal(name: string): Error {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, {
    expected: `field ${name} reads no sensitive control`,
    actual: `sensitive_value: field ${name} resolved to a sensitive control, so its value is never read`
  });
  return Object.assign(
    new Error(`The extract_list field ${JSON.stringify(name)} resolved to a sensitive control, so its value is never read.`),
    { failure }
  );
}

/**
 * Whether the list became a different list. A page that replaces its results
 * detaches the old items, and one that appends changes their number, so both
 * are observed without knowing how the page loads -- and the old page staying
 * on screen while the new one loads reads as "not yet changed" rather than as a
 * second read of the same page.
 *
 * The wait ends at the earlier of `LIST_CHANGE_TIMEOUT_MS` and the command's
 * deadline, and says which one ended it: the first is a page that ignored its
 * own control, the second is the read running out of time.
 */
async function waitForListChange(itemSelector: string, previous: readonly Element[], actionDeadline: number | undefined): Promise<ListChange> {
  const changeDeadline = Date.now() + LIST_CHANGE_TIMEOUT_MS;
  const commandEndsFirst = actionDeadline !== undefined && actionDeadline <= changeDeadline;
  const deadline = commandEndsFirst ? actionDeadline : changeDeadline;
  while (!listChanged(itemSelector, previous)) {
    const now = Date.now();
    if (now >= deadline) return commandEndsFirst ? "timed_out" : "unchanged";
    await delay(Math.min(LIST_CHANGE_POLL_MS, deadline - now));
  }
  return "changed";
}

function listChanged(itemSelector: string, previous: readonly Element[]): boolean {
  const current = document.querySelectorAll(itemSelector);
  const first = previous[0];
  if (!first) return current.length > 0;
  return !first.isConnected || current.length !== previous.length || current[0] !== first;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
