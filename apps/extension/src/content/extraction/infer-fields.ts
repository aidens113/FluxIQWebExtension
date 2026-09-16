// The fields a record exposes, inferred from one item of a run (C4).
//
// Where a field comes from, in the order the page offers them:
// - a table row's cells are read by the header above them, as `column` fields,
//   so the proposal survives a column reorder exactly as a hand-written
//   `column:` field does;
// - otherwise each descendant that names itself or carries a value: an `<img>`
//   gives its `src` and its `alt`, an `<a href>` gives a `link`, a form control
//   gives its live `value`, an element with a test id gives its `text`, and a
//   remaining leaf with words in it gives its `text`.
//
// Coverage is the share of the run's items the field resolves in, and a field
// that does not resolve in every item is proposed optional, so a record that
// lacks it carries `null` rather than failing the read (decision D16).
//
// **A field whose element is, or sits inside, a sensitive control is proposed
// `handling: "exclude"`** -- decision D12's pre-selection, which the user may
// change in the picker but inference never can. The rule asked is
// `isWithinSensitiveControl`, the ancestor-aware one, not `isSensitiveFormControl`
// alone: `field-reader.ts` refuses a read that resolves to anything inside a
// sensitive control (D2), so a field proposed `include` there would refuse the
// whole extraction rather than read one column.
//
// No label is text read inside an item (decision D3). A label is a test id, a
// column header -- page structure, not a sample value (D16) -- an attribute
// name, or the item's own tag and position. The key is derived from the label
// by the one domain key function, so every key is one Core's dataset schema
// accepts.

import {
  webAutomationExtractionFieldKey,
  type WebAutomationExtractFieldKind,
  type WebAutomationExtractionProposalField,
  type WebAutomationExtractionProposalFieldSpec
} from "@fluxiq-web-extension/domain/client";
import { testIdFor } from "../describe-element";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";

/**
 * One place a record's value comes from, before it is keyed and measured. The
 * label and every selector here are page structure; no field of this type ever
 * holds text read inside an item.
 */
export type FieldSource = {
  kind: WebAutomationExtractFieldKind;
  /** What the picker shows for the field. Never text read inside an item. */
  label: string;
  /** Where inside the item the value is read; absent, the item itself. Not used by `column`. */
  selector?: string | undefined;
  /** The attribute an `attribute` field reads. */
  attribute?: string | undefined;
  /** The header text a `column` field reads under. */
  header?: string | undefined;
  /** The header's position among the row's cells, which is how coverage is counted. */
  columnIndex?: number | undefined;
  /** Whether the element the field reads is, or sits inside, a sensitive control. */
  sensitive: boolean;
};

/** The form controls whose live value a record can read. */
const VALUE_TAGS = new Set(["input", "textarea", "select"]);

/** At most this many fields are proposed: a picker the user must scroll to reject is not a proposal. */
const MAX_PROPOSED_FIELDS = 12;

/**
 * The fields the run exposes, keyed and measured, in the order the page offers
 * them. Empty when the item exposes nothing a record could read.
 */
export function inferFields(item: Element, run: readonly Element[]): WebAutomationExtractionProposalField[] {
  const taken = new Set<string>();
  return fieldSources(item).slice(0, MAX_PROPOSED_FIELDS).map((source) => {
    const coverage = coverageOf(source, run);
    const key = webAutomationExtractionFieldKey(source.label, taken);
    taken.add(key);
    return { key, label: source.label, spec: proposedFieldSpec(source, coverage), coverage };
  });
}

/**
 * The spec a source proposes. Pure: `required` follows from coverage, and a
 * sensitive source is `handling: "exclude"` whatever else it says (D12).
 */
export function proposedFieldSpec(source: FieldSource, coverage: number): WebAutomationExtractionProposalFieldSpec {
  return {
    kind: source.kind,
    ...(source.selector === undefined ? {} : { selector: source.selector }),
    ...(source.attribute === undefined ? {} : { attribute: source.attribute }),
    ...(source.header === undefined ? {} : { header: source.header }),
    required: coverage >= 1,
    ...(source.sensitive ? { handling: "exclude" as const } : {})
  };
}

/** A table row reads its cells by header; anything else reads what its descendants offer. */
function fieldSources(item: Element): FieldSource[] {
  const columns = columnSources(item);
  return columns.length > 0 ? columns : elementSources(item);
}

/**
 * One `column` source per header cell of the table the item is a row of, in
 * header order. Empty for an item that is not a row, or a row in a table with
 * no header row -- there the cells have no names, and reading them by position
 * is what a column reorder breaks.
 */
function columnSources(item: Element): FieldSource[] {
  if (item.tagName !== "TR") return [];
  const table = item.closest("table");
  const headerRow = table?.tHead?.rows[0]
    ?? Array.from(table?.rows ?? []).find((row) => Array.from(row.cells).some((cell) => cell.tagName === "TH"));
  if (!headerRow) return [];
  return Array.from(headerRow.cells).flatMap((cell, columnIndex) => {
    const header = collapsed(textOutsideSensitiveControls(cell));
    if (!header) return [];
    const bodyCell = (item as HTMLTableRowElement).cells[columnIndex];
    return [{
      kind: "column" as const,
      label: header,
      header,
      columnIndex,
      sensitive: isWithinSensitiveControl(cell) || (bodyCell !== undefined && isWithinSensitiveControl(bodyCell))
    }];
  });
}

/** What the item's descendants offer, in document order, one source per element but for an image. */
function elementSources(item: Element): FieldSource[] {
  const sources: FieldSource[] = [];
  const leafOrdinals = new Map<string, number>();
  for (const element of item.querySelectorAll("*")) {
    if (sources.length >= MAX_PROPOSED_FIELDS) break;
    const tag = element.tagName.toLowerCase();
    const testId = testIdFor(element);
    const selector = selectorWithinItem(item, element, tag);
    if (selector === undefined) continue;
    const sensitive = isWithinSensitiveControl(element);
    const named = testId ?? `${tag} ${nextOrdinal(leafOrdinals, tag)}`;
    if (tag === "img") {
      sources.push({ kind: "attribute", label: `${named} src`, selector, attribute: "src", sensitive });
      sources.push({ kind: "attribute", label: `${named} alt`, selector, attribute: "alt", sensitive });
    } else if (tag === "a" && element.getAttribute("href") !== null) {
      sources.push({ kind: "link", label: named, selector, sensitive });
    } else if (VALUE_TAGS.has(tag)) {
      sources.push({ kind: "value", label: named, selector, sensitive });
    } else if (testId || isTextLeaf(element)) {
      sources.push({ kind: "text", label: named, selector, sensitive });
    }
  }
  return sources;
}

/**
 * A selector that finds exactly this element inside the item: its test id, or
 * its tag with its position among its parent's elements of that tag. An element
 * neither names uniquely is left out rather than proposed as a field that would
 * read a different element in another item.
 */
function selectorWithinItem(item: Element, element: Element, tag: string): string | undefined {
  for (const candidate of [testIdSelector(element), positionSelector(element, tag)]) {
    if (candidate && item.querySelectorAll(candidate).length === 1 && item.querySelector(candidate) === element) return candidate;
  }
  return undefined;
}

function testIdSelector(element: Element): string | undefined {
  for (const attribute of ["data-testid", "data-test", "data-cy"]) {
    const value = element.getAttribute(attribute);
    if (value) return `[${attribute}="${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"]`;
  }
  return undefined;
}

function positionSelector(element: Element, tag: string): string | undefined {
  const siblings = Array.from(element.parentElement?.children ?? []).filter((child) => child.tagName === element.tagName);
  const index = siblings.indexOf(element) + 1;
  if (index === 0) return undefined;
  return siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag;
}

/**
 * Whether the element holds words of its own and no elements. The text is read
 * through the one sensitive-text reader, so a marked control's contents do not
 * even decide that a field exists, and it is never carried anywhere.
 */
function isTextLeaf(element: Element): boolean {
  return element.children.length === 0 && collapsed(textOutsideSensitiveControls(element)) !== "";
}

/** The share of the run's items the field resolves in, from 0 to 1. */
function coverageOf(source: FieldSource, run: readonly Element[]): number {
  if (run.length === 0) return 0;
  const found = run.filter((item) => resolvesIn(source, item)).length;
  return Math.round((found / run.length) * 100) / 100;
}

/**
 * Whether the field would read something from this item. Presence only: no
 * value is read, and a `text` field resolves wherever its element is, because
 * an element with no words still gives the record an empty string.
 */
function resolvesIn(source: FieldSource, item: Element): boolean {
  if (source.kind === "column") {
    const cells = (item as HTMLTableRowElement).cells;
    return source.columnIndex !== undefined && cells !== undefined && cells[source.columnIndex] !== undefined;
  }
  const element = source.selector ? item.querySelector(source.selector) : item;
  if (!element) return false;
  if (source.kind === "attribute") return source.attribute !== undefined && element.hasAttribute(source.attribute);
  if (source.kind === "link") return element.getAttribute("href") !== null;
  return true;
}

function nextOrdinal(ordinals: Map<string, number>, tag: string): number {
  const next = (ordinals.get(tag) ?? 0) + 1;
  ordinals.set(tag, next);
  return next;
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
