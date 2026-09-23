// Reads one normalized field (`field-spec.ts`) from one item: the value its
// record carries, `null` for an optional field the page cannot read (decision
// D16), or `undefined` for a required one, which the list reader reports
// missing.
//
// What each kind reads, from the element its selector finds inside the item,
// or from the item itself when it names none:
// - `text`: the page's own tightest statement of the value the element shows
//   (`value-statement.ts`) and otherwise the element's whitespace-collapsed
//   text, with the contents of every sensitive control inside it left out. The
//   text comes from `textOutsideSensitiveControls` (`content/sensitive-text.ts`),
//   the one text reader snapshots, accessible names and the extract verb share,
//   collapsed exactly as the extract verb's `readableText` collapses it. That
//   function is not imported: `action-runtime/` wires this directory in, and
//   reaching past its barrel into `extract.ts` would be a crossing the
//   structure audit counts. The tightest statement is what the page declares --
//   microdata's `content`, `aria-valuenow`, an `aria-label` restating its own
//   text, or the copy of a paired rendering the page marked `aria-hidden` --
//   never anything read out of the words, so an element that declares nothing
//   tighter reads exactly as it always did;
// - `attribute`: that attribute, unreadable when the element does not carry it;
// - `link`: the `href` resolved against the element's base URL, unreadable when
//   there is none or it resolves to anything but http or https, so a
//   `javascript:` or `mailto:` target is never returned as a link;
// - `value`: a form control's live value, unreadable on anything else;
// - `column`: the cell under the header in the item's table row, matched by
//   position among the row's cells, which is what survives a column reorder;
//   colspan is not modelled. A header no cell matches is unreadable, so the
//   field is never read from the wrong column.
//
// Every kind refuses a sensitive control first, and an element inside one too,
// such as an option of a sensitive select (decision D2): the whole read is
// refused with an ACTION_REJECTED record that names the author's field and
// quotes no value, rather than returned without that field. `value` is the read
// that most needs it, since a sensitive control's live value is the secret
// itself. A `column` field on items that are not table rows cannot be
// performed, so it throws.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";
import type { ExtractFieldReader } from "./field-spec";
import { tightestStatedValue } from "./value-statement";

type ElementFieldReader = Exclude<ExtractFieldReader, { kind: "column" }>;

export function readField(item: Element, name: string, reader: ExtractFieldReader): string | null | undefined {
  const value = reader.kind === "column" ? readColumn(item, name, reader.header) : readElement(item, name, reader);
  if (value !== undefined) return value;
  return reader.required ? undefined : null;
}

function readElement(item: Element, name: string, reader: ElementFieldReader): string | undefined {
  const element = reader.selector ? item.querySelector(reader.selector) : item;
  if (!element) return undefined;
  if (isWithinSensitiveControl(element)) throw sensitiveFieldRefusal(name);
  switch (reader.kind) {
    case "text":
      return readText(element);
    case "attribute":
      return element.getAttribute(reader.attribute) ?? undefined;
    case "link":
      return linkTarget(element);
    case "value":
      return controlValue(element);
  }
}

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
  if (isWithinSensitiveControl(cell)) throw sensitiveFieldRefusal(name);
  return readText(cell);
}

function readText(element: Element): string {
  return tightestStatedValue(element) ?? normalizeText(textOutsideSensitiveControls(element));
}

/** The `href` as an absolute http(s) URL, or `undefined` when there is none or it is not one. */
function linkTarget(element: Element): string | undefined {
  const href = element.getAttribute("href");
  if (href === null) return undefined;
  try {
    const url = new URL(href, element.baseURI);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function controlValue(element: Element): string | undefined {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
    ? element.value
    : undefined;
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

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
