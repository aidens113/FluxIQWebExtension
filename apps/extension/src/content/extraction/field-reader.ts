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
//   tighter reads exactly as it always did. Where the element is, or holds, the
//   host of an open shadow root, the text is instead what the page draws there
//   (`drawnText`, below), because `textContent` never enters a shadow root;
// - `attribute`: that attribute, unreadable when the element does not carry it;
// - `link`: the `href` resolved against the element's base URL, unreadable when
//   there is none or it resolves to anything but http or https, so a
//   `javascript:` or `mailto:` target is never returned as a link;
// - `value`: a form control's live value, unreadable on anything else and on a
//   control whose value is never the record's (`record-control.ts`): a
//   checkbox or radio button with no `value` attribute, whose value is the
//   constant `"on"`, a button-like input, whose value is its caption, and a
//   file input. Detection never offers those, so a read never returns one;
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
import { isSensitiveFormControl } from "../element-traits";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";
import type { ExtractFieldReader } from "./field-spec";
import { recordControlType } from "./record-control";
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
  return tightestStatedValue(element)
    ?? normalizeText(hostsOpenShadowRoot(element) ? drawnText(element) : textOutsideSensitiveControls(element));
}

/**
 * How many nodes one text read visits once it crosses into a shadow root. A
 * field is a title, a price, a row; the bound is what keeps a component that
 * stamps a large tree from turning one field into an unbounded walk.
 */
const MAX_DRAWN_NODES = 10_000;

/** Elements whose text is never drawn, which a shadow root routinely carries -- a component's own stylesheet above all. */
const UNDRAWN_TAGS: ReadonlySet<string> = new Set(["STYLE", "SCRIPT", "TEMPLATE", "NOSCRIPT"]);

/** Whether the element, or anything inside it, hosts an open shadow root. A closed root is unreachable and reads as its host's light text. */
function hostsOpenShadowRoot(element: Element): boolean {
  if (element.shadowRoot) return true;
  for (const descendant of element.querySelectorAll("*")) {
    if (descendant.shadowRoot) return true;
  }
  return false;
}

/**
 * The element's text as the page draws it, in document order: a host of an
 * open shadow root reads what its root holds rather than its light children,
 * and a `<slot>` reads the light nodes assigned to it, or its fallback when
 * none are. It is `textOutsideSensitiveControls` across shadow boundaries --
 * every subtree rooted at a sensitive control is left out by the same shared
 * rule (decision D2) -- and it also leaves out a stylesheet or script, whose
 * text is not drawn.
 *
 * **Until 2026-09-30 the text in a shadow root was never read.** The
 * professional network's sent invitations draw each request's age with a
 * `gl-time-ago` element whose words ("Sent 1 month ago") exist only in its open
 * shadow root, so a text field on the age read `""` and one on the whole row
 * read the row without it, and "withdraw every request a month or more old"
 * had no value to filter on (`t195-w9-row-age-in-shadow.md`).
 */
function drawnText(element: Element): string {
  let text = "";
  let visited = 0;
  const pending: Node[] = [...drawnChildren(element)].reverse();
  for (let node = pending.pop(); node && visited < MAX_DRAWN_NODES; node = pending.pop()) {
    visited += 1;
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue ?? "";
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;
    if (UNDRAWN_TAGS.has(child.tagName.toUpperCase()) || isSensitiveFormControl(child)) continue;
    const inner = drawnChildren(child);
    for (let index = inner.length - 1; index >= 0; index -= 1) {
      const next = inner[index];
      if (next) pending.push(next);
    }
  }
  return text;
}

/** What is drawn inside an element: its open shadow root's nodes, a slot's assigned nodes, or else its own children. */
function drawnChildren(element: Element): readonly Node[] {
  if (element.shadowRoot) return [...element.shadowRoot.childNodes];
  if (element.tagName.toUpperCase() === "SLOT" && typeof (element as HTMLSlotElement).assignedNodes === "function") {
    const assigned = (element as HTMLSlotElement).assignedNodes();
    if (assigned.length > 0) return assigned;
  }
  return [...element.childNodes];
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
  const control = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
  return control && recordControlType(element) !== undefined ? element.value : undefined;
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
