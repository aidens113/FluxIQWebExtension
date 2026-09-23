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
// name, or the path from the item down to the element. The key is derived from
// the label by the one domain key function, so every key is one Core's dataset
// schema accepts.
//
// **An element is named by its path from the item, and until 2026-09-23 it was
// not.** A field was named by the element's tag and its position among its
// *parent's* children -- `span:nth-of-type(3)` -- and then kept only if that
// named exactly one element in the whole item. On anything but a flat item that
// is almost never true, so almost every field was dropped: measured model-free
// on the everything-store's search results, a product card exposed five fields
// -- the image's `src` and `alt`, one stray span, the delivery date and the Add
// to cart button -- and **not its name, its price, its rating or its link**,
// which are the four columns the instruction asked for. The model is shown only
// the columns detection proposes and may only keep and rename them, so the
// answer it could build was wrong before it chose anything. A path anchored at
// the item (`:scope > div > h2 > a > span`) names one element by construction,
// so a nested value is a field like any other.

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

/**
 * At most this many fields are proposed, keeping the widest-covering.
 *
 * It was 12, which is what a person will read in a picker, and on a realistic
 * item that cut the answer off: measured on the everything-store's search
 * results, a product card's twelfth readable descendant in document order is
 * reached before its price, so a proposal of twelve carried the title, the
 * rating and the link and **not the price**. A field that is not proposed is a
 * column the model cannot ask for at all, so the bound is now what an item
 * plausibly exposes rather than what a list reads tidily, and the widest
 * covering are the ones kept. The packet the model is shown has its own byte
 * budget and says when it truncated (`structure/packet.ts`).
 */
const MAX_PROPOSED_FIELDS = 24;

/** How many sources are collected before coverage decides between them. Bounds the walk on a large item. */
const MAX_CANDIDATE_FIELDS = 64;

/** A tag a path step can name without escaping, so a proposal never depends on `CSS.escape` being reachable. */
const PLAIN_TAG = /^[a-z][a-z0-9-]*$/u;

/** An `itemprop` a step can name as written: a single vocabulary term, never a sentence or a URL. */
const PLAIN_PROPERTY = /^[A-Za-z_][\w.-]{0,63}$/u;

/** A class name that needs no escaping, as `item-selector.ts` holds its own candidates to. */
const PLAIN_CLASS = /^[A-Za-z_-][\w-]*$/u;

/** At most this many of an element's classes enter a path step, as the item signature caps its own. */
const MAX_STEP_CLASSES = 3;

/**
 * The fields the run exposes, keyed and measured, in the order the page offers
 * them. Empty when the item exposes nothing a record could read.
 */
export function inferFields(item: Element, run: readonly Element[]): WebAutomationExtractionProposalField[] {
  // Coverage decides which sources survive the bound, not the order the page
  // happens to offer them in: an item's first descendants are its chrome --
  // a Sponsored label, an image -- and its value is further down. `sort` is
  // stable, so equal coverage keeps document order, and the survivors are put
  // back into document order so a record's columns read as the page reads.
  const measured = fieldSources(item).map((source, position) => ({ source, position, coverage: coverageOf(source, run) }));
  const kept = [...measured]
    .sort((left, right) => right.coverage - left.coverage)
    .slice(0, MAX_PROPOSED_FIELDS)
    .sort((left, right) => left.position - right.position);
  const taken = new Set<string>();
  return kept.map(({ source, coverage }) => {
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
  for (const element of item.querySelectorAll("*")) {
    if (sources.length >= MAX_CANDIDATE_FIELDS) break;
    const tag = element.tagName.toLowerCase();
    const named = selectorWithinItem(item, element);
    if (named === undefined) continue;
    const { selector, label } = named;
    const sensitive = isWithinSensitiveControl(element);
    if (tag === "img") {
      sources.push({ kind: "attribute", label: `${label} src`, selector, attribute: "src", sensitive });
      sources.push({ kind: "attribute", label: `${label} alt`, selector, attribute: "alt", sensitive });
    } else if (tag === "a" && element.getAttribute("href") !== null) {
      sources.push({ kind: "link", label, selector, sensitive });
    } else if (VALUE_TAGS.has(tag)) {
      sources.push({ kind: "value", label, selector, sensitive });
    } else if (testIdFor(element) !== undefined || isTextLeaf(element)) {
      sources.push({ kind: "text", label, selector, sensitive });
    }
  }
  return sources;
}

/**
 * How an element is named inside its item: the selector a field reads it by,
 * and the label the field is shown under. Both are page structure.
 */
type FieldName = { selector: string; label: string };

/** How deep inside an item a field may sit. Past this the path is longer than it is worth reading. */
const MAX_PATH_STEPS = 8;

/**
 * A selector that finds exactly this element inside the item: its test id, or
 * the path from the item down to it, anchored with `:scope` so the first step
 * is the item's own child rather than any descendant. An element neither names
 * uniquely is left out rather than proposed as a field that would read a
 * different element in another item.
 */
function selectorWithinItem(item: Element, element: Element): FieldName | undefined {
  const testId = testIdName(element);
  if (testId && namesOnly(item, testId.selector, element)) return testId;
  const path = pathWithinItem(item, element);
  if (path && namesOnly(item, path.selector, element)) return path;
  return undefined;
}

/** The element's test id as a field name: the attribute selector that finds it, shown under the id itself. */
function testIdName(element: Element): FieldName | undefined {
  const selector = testIdSelector(element);
  const label = testIdFor(element);
  return selector === undefined || label === undefined ? undefined : { selector, label };
}

/** Whether the selector names this element inside the item and nothing else. */
function namesOnly(item: Element, selector: string, element: Element): boolean {
  try {
    return item.querySelectorAll(selector).length === 1 && item.querySelector(selector) === element;
  } catch {
    return false;
  }
}

/**
 * The path from the item down to the element, one step per level
 * (`pathStep`). The selector is anchored at the item with `:scope`, so its
 * first step is the item's own child; the label is the same path written for a
 * reader, with `span:nth-of-type(2)` as `span:2`.
 */
function pathWithinItem(item: Element, element: Element): FieldName | undefined {
  const selectorSteps: string[] = [];
  const labelSteps: string[] = [];
  for (let current: Element | null = element; current && current !== item; current = current.parentElement) {
    if (selectorSteps.length >= MAX_PATH_STEPS) return undefined;
    const step = pathStep(current);
    if (step === undefined) return undefined;
    selectorSteps.unshift(step.selector);
    labelSteps.unshift(step.label);
  }
  if (selectorSteps.length === 0) return undefined;
  return { selector: `:scope > ${selectorSteps.join(" > ")}`, label: labelSteps.join(" > ") };
}

/**
 * One step of a path, in the order the page names things: a test id, the
 * schema.org property the page declares on it, the tag with the classes it is
 * styled by, the bare tag, and only then its position among its parent's
 * elements of that tag.
 *
 * `itemprop` is in that list because it is the one part of a real page's markup
 * that says what a value *means*, and the model choosing columns is shown the
 * label and nothing else. Live, on a card whose rating reads `4.5` and whose
 * price reads `$39.99`, a model handed two paths that differed only in hashed
 * class names mapped the rating column to `price`
 * (`adaptation.bootstrap.6888898c`). `div[itemprop="offers"]` in the path says
 * which one is the price without quoting either. It is a vocabulary term the
 * page author wrote, like a test id, not text read inside an item (D3).
 *
 * Position is the last resort because it is the one step a sibling can break.
 * A sponsored card is the same template as an organic one with a "Sponsored"
 * label pushed in front, so a positional path read off a sponsored card
 * resolved in the four sponsored cards of a twenty-card run and in none of the
 * sixteen results -- coverage 0.2, and a title that read `null` for every row
 * a person actually asked for. The class step names the same element in both.
 */
function pathStep(element: Element): FieldName | undefined {
  const tag = element.tagName.toLowerCase();
  // A tag a selector could not hold without escaping is not named at all,
  // rather than named with a selector that might not parse.
  if (!PLAIN_TAG.test(tag)) return undefined;
  const testId = testIdName(element);
  const property = itemProperty(element);
  for (const candidate of [testId, property, named(`${tag}${stepClasses(element)}`), named(tag)]) {
    if (candidate !== undefined && namesOnlyChild(element, candidate.selector)) return candidate;
  }
  const siblings = Array.from(element.parentElement?.children ?? []).filter((child) => child.tagName === element.tagName);
  const index = siblings.indexOf(element) + 1;
  if (index === 0) return undefined;
  return { selector: `${tag}:nth-of-type(${index})`, label: `${tag}:${index}` };
}

/** The schema.org property the page declares on the element, as a step, when it is a plain vocabulary term. */
function itemProperty(element: Element): FieldName | undefined {
  const property = element.getAttribute("itemprop");
  if (property === null || !PLAIN_PROPERTY.test(property)) return undefined;
  return named(`${element.tagName.toLowerCase()}[itemprop="${property}"]`);
}

/** A step whose selector is also how it reads. */
function named(selector: string): FieldName {
  return { selector, label: selector };
}

/** `.a.b` for the classes a step can name without escaping, capped as the item signature caps its own. */
function stepClasses(element: Element): string {
  return [...element.classList]
    .filter((name) => PLAIN_CLASS.test(name))
    .sort()
    .slice(0, MAX_STEP_CLASSES)
    .map((name) => `.${name}`)
    .join("");
}

/** Whether the candidate names this element among its parent's children and nothing else there. */
function namesOnlyChild(element: Element, candidate: string): boolean {
  const parent = element.parentElement;
  if (!parent) return false;
  try {
    const matched = parent.querySelectorAll(`:scope > ${candidate}`);
    return matched.length === 1 && matched[0] === element;
  } catch {
    return false;
  }
}

function testIdSelector(element: Element): string | undefined {
  for (const attribute of ["data-testid", "data-test", "data-cy"]) {
    const value = element.getAttribute(attribute);
    if (value) return `[${attribute}="${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"]`;
  }
  return undefined;
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

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
