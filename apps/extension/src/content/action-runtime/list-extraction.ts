// Reading a repeating structure into records.
//
// `item` selects each record's root; `fields` maps a field name to a selector
// inside it, in the scenario contract's forms: a plain selector reads text, an
// empty one reads the item itself, `selector@attribute` reads an attribute, and
// `column:<header text>` reads the cell under that header when the items are
// table rows, so extraction survives a column reorder. With `paginate`, the
// `next` control is followed until it is absent or `maxPages` pages have been
// read, waiting for the list to change after each page rather than for a fixed
// delay. `maxItems` bounds the result.
//
// `missingFields` names every declared field that some record lacked, which is
// what makes the verb's validation fail instead of silently returning blanks. A
// `column:` header that no header cell matches is missing from every record, so
// it lands there too: a page that renamed a column reports the rename rather
// than quietly returning records without that field.
//
// Two conditions are not "the page differs" but "the request cannot be
// performed", so they throw and become a failed result: a `column:` field on
// items that are not table rows, and a `next` control that was followed without
// the list ever changing. Neither may end the read quietly -- a short record
// list that still validates is exactly the silent no-op decision D4 forbids.

import type { WebAutomationExtractListRequest } from "../types";

export type ExtractedListRecord = Record<string, string>;

export type ListExtractionOutcome = {
  records: ExtractedListRecord[];
  /** Pages actually read, the first included. */
  pagesRead: number;
  /** Whether `maxItems` or `maxPages` stopped the read before the list ended. */
  truncated: boolean;
  /** Declared fields that at least one record did not yield. */
  missingFields: string[];
};

/**
 * The upper bound on pages one extraction may follow, mirroring the domain's
 * `WEB_AUTOMATION_EXTRACT_MAX_PAGES`. It is restated as a number because the
 * content script must not import the domain's runtime: a value import would
 * pull the domain barrel into the page bundle.
 * `tests/list-extraction.test.ts` asserts the two agree.
 */
export const EXTRACT_MAX_PAGES = 50;

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

export async function extractList(request: WebAutomationExtractListRequest): Promise<ListExtractionOutcome> {
  const item = request.item.trim();
  if (!item) throw new Error("An extract_list request needs an item selector.");
  const fields: ParsedField[] = Object.entries(request.fields).map(([name, spec]) => [name, parseExtractField(spec)] as const);
  if (fields.length === 0) throw new Error("An extract_list request names no fields.");
  const maxPages = request.paginate ? Math.min(Math.max(1, Math.trunc(request.paginate.maxPages)), EXTRACT_MAX_PAGES) : 1;
  const maxItems = request.maxItems === undefined ? undefined : Math.max(0, Math.trunc(request.maxItems));

  const records: ExtractedListRecord[] = [];
  const missing = new Set<string>();
  let pagesRead = 0;
  let truncated = false;

  for (;;) {
    const items = Array.from(document.querySelectorAll(item));
    pagesRead += 1;
    for (const element of items) {
      if (maxItems !== undefined && records.length >= maxItems) {
        truncated = true;
        break;
      }
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
    next.click();
    if (!await waitForListChange(item, items)) {
      throw new Error(`The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of following ${JSON.stringify(paginate.next)} to page ${pagesRead + 1}.`);
    }
  }

  return { records, pagesRead, truncated, missingFields: [...missing].sort() };
}

function readRecord(item: Element, fields: readonly ParsedField[], missing: Set<string>): ExtractedListRecord {
  const record: ExtractedListRecord = {};
  for (const [name, field] of fields) {
    const value = readField(item, field);
    if (value === undefined) missing.add(name);
    else record[name] = value;
  }
  return record;
}

function readField(item: Element, field: ExtractField): string | undefined {
  if (field.kind === "column") return readColumn(item, field.header);
  const element = field.selector ? item.querySelector(field.selector) : item;
  if (!element) return undefined;
  if (field.attribute !== undefined) return element.getAttribute(field.attribute) ?? undefined;
  return normalizeText(element.textContent ?? "");
}

/**
 * The cell under `header` in this row. Cells are matched by position among
 * their row's cells, which is what survives a column reorder; colspan is not
 * modelled. A header no cell matches yields nothing, so the field is reported
 * missing rather than read from the wrong column.
 */
function readColumn(item: Element, header: string): string | undefined {
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
  return cell ? normalizeText(cell.textContent ?? "") : undefined;
}

/**
 * Whether the list became a different list. A page that replaces its results
 * detaches the old items, and one that appends changes their number, so both
 * are observed without knowing how the page loads -- and the old page staying
 * on screen while the new one loads reads as "not yet changed" rather than as a
 * second read of the same page.
 */
async function waitForListChange(itemSelector: string, previous: readonly Element[]): Promise<boolean> {
  const deadline = Date.now() + LIST_CHANGE_TIMEOUT_MS;
  while (!listChanged(itemSelector, previous)) {
    if (Date.now() >= deadline) return false;
    await delay(LIST_CHANGE_POLL_MS);
  }
  return true;
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
