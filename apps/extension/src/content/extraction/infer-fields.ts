// The fields a record exposes, inferred from one item of a run (C4).
//
// Where a field comes from, in the order the page offers them:
// - a table row's cells are read by the header above them, as `column` fields,
//   so the proposal survives a column reorder exactly as a hand-written
//   `column:` field does;
// - otherwise the item's own `data-*` attributes, which are what a page states
//   *about* an item rather than inside it -- `data-ad-id` on a sponsored card,
//   `data-item-id` on a listing -- read as `attribute` fields off the item;
// - and each descendant that names itself or carries a value: an `<img>`
//   gives its `src` and its `alt`, an `<a href>` gives a `link`, a form control
//   gives its live `value`, an element with a test id gives its `text`, and a
//   remaining leaf with words in it gives its `text`.
//
// **A value the page draws twice is proposed once, as the page's own tightest
// statement of it.** The everything store's rating is
// `<span aria-hidden="true">3.7</span>` beside `<i><span>3.7 out of 5 stars
// </span></i>`: two text leaves, both covering every item, sitting next to each
// other under labels that are hashed class names, so a model choosing columns
// has nothing to tell them apart with. It chose the sentence, and a nine-node
// Flow that branched correctly and read every requested column matched zero
// rows because every rating read `3.7 out of 5 stars` where `3.7` was expected
// (`test-runs/instances/r5/run-mudwci8d-de88aa32`). A leaf the page states more
// tightly elsewhere is no longer offered at all, so the trap is not put in
// front of the model rather than being explained to it. What counts as the same
// value stated twice is the page's own `aria-hidden` mark and never a reading
// of the words; `value-statement.ts` holds that rule and why it has to be a
// mark.
//
// **Sources come from the run, not from one item of it, and until 2026-09-23
// they came from one.** A mark is a value only some items carry -- the ad label
// on a sponsored card, the "Sponsored" tag on a promoted tile -- and the item
// the walk starts from is the run's first, so a mark the first item happens not
// to carry was invisible: measured model-free, the bigbox retailer's results
// page puts its advertisements at the second, seventh and eleventh tiles, and
// its "Sponsored" tag appeared in no proposal at all, while the everything
// store's was proposed only because its first card is an advertisement. A
// column nothing proposes is a column the model cannot ask for, and with no
// column naming the mark there is no way to say which items a read wants (C5).
// So every item of the run offers its sources, each is kept once, and each sits
// at the position it had in the item that first offered it.
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
import { statedMoreTightly } from "./value-statement";

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

/**
 * How many of those places are held for columns that only *some* items have.
 *
 * Coverage decides the rest, and coverage alone is exactly the wrong judge
 * here: a column every item carries is the fullest column and says nothing
 * about *which* items a read wants, so a bound that keeps the widest-covering
 * fields cuts the marks first. A mark is by construction a partial column --
 * four sponsored cards among twenty -- so a few places are held for partial
 * columns before coverage spends the rest.
 */
const RESERVED_PARTIAL_FIELDS = 8;

/** How many sources are collected before coverage decides between them. Bounds the walk on a large item. */
const MAX_CANDIDATE_FIELDS = 64;

/** How many items of a run are walked for sources. Every item still counts toward each source's coverage. */
const MAX_SCANNED_ITEMS = 12;

/** How many of an item's own attributes become fields, so a container dense with data attributes cannot crowd out its values. */
const MAX_ITEM_ATTRIBUTES = 8;

/** A `data-*` attribute a field can name as written. `data-` alone names nothing, and a name a selector could not hold is not named. */
const ITEM_ATTRIBUTE = /^data-[A-Za-z][\w-]*$/u;

/**
 * The attributes that name an element rather than say anything about it.
 *
 * A test id is how this module already names elements -- it is the label and
 * the selector (`testIdName`) -- so reading it again as a column would add a
 * column of the item's own name to every record. It also has a worse effect
 * than clutter: a run of nothing but a password is refused `sensitive_region`
 * because it has no readable field (D12), and a test id proposed as a column
 * would give it one, so the row would be proposed with the secret's column
 * excluded and its id read instead.
 */
const IDENTITY_ATTRIBUTES: ReadonlySet<string> = new Set(["data-testid", "data-test", "data-cy"]);

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
  // Before coverage spends the bound, a few places go to the columns only some
  // items have, which are the ones a read narrowing the run has to name.
  const measured = fieldSources(item, run).map((source, position) => ({ source, position, coverage: coverageOf(source, run) }));
  const byCoverage = [...measured].sort((left, right) => right.coverage - left.coverage);
  const reserved = new Set(byCoverage.filter((entry) => entry.coverage > 0 && entry.coverage < 1).slice(0, Math.min(RESERVED_PARTIAL_FIELDS, MAX_PROPOSED_FIELDS)));
  const kept = [...reserved, ...byCoverage.filter((entry) => !reserved.has(entry)).slice(0, MAX_PROPOSED_FIELDS - reserved.size)]
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

/**
 * A table row reads its cells by header; anything else reads what the run's
 * items offer -- their own marks and their descendants.
 *
 * A source is kept once, under the position it had in the item that first
 * offered it, and the sort is stable, so a mark that is an item's first child
 * sorts to the front of the proposal wherever in the run it was found, while
 * values two items share keep the order the page draws them in. The item the
 * caller named is walked first, so a run whose items are all alike proposes
 * exactly what it proposed before this existed.
 */
function fieldSources(item: Element, run: readonly Element[]): FieldSource[] {
  const columns = columnSources(item);
  if (columns.length > 0) return columns;
  const taken = new Set<string>();
  const collected: Array<{ source: FieldSource; position: number }> = [];
  for (const candidate of [item, ...run.slice(0, MAX_SCANNED_ITEMS)]) {
    if (collected.length >= MAX_CANDIDATE_FIELDS) break;
    let position = 0;
    for (const source of [...itemAttributeSources(candidate), ...elementSources(candidate)]) {
      position += 1;
      const identity = [source.kind, source.selector ?? "", source.attribute ?? "", source.header ?? ""].join("\u0000");
      if (taken.has(identity)) continue;
      taken.add(identity);
      if (collected.length >= MAX_CANDIDATE_FIELDS) break;
      collected.push({ source, position });
    }
  }
  return collected.sort((left, right) => left.position - right.position).map(({ source }) => source);
}

/**
 * The item's own `data-*` attributes, read off the item itself.
 *
 * This is the one part of a card's markup that says what the card *is* rather
 * than what it shows, and it is the mark a real results page puts on an
 * advertisement: `data-ad-id` on the everything store's sponsored cards,
 * `data-adid` on the auction marketplace's. It is also the one label a model
 * can read on a page whose class names are hashed -- the attribute's own name,
 * which the page's author wrote, and never a value read inside the item (D3).
 */
function itemAttributeSources(item: Element): FieldSource[] {
  const sensitive = isWithinSensitiveControl(item);
  return Array.from(item.attributes)
    .filter((attribute) => ITEM_ATTRIBUTE.test(attribute.name) && !IDENTITY_ATTRIBUTES.has(attribute.name))
    .slice(0, MAX_ITEM_ATTRIBUTES)
    .map((attribute) => ({ kind: "attribute" as const, label: attribute.name, attribute: attribute.name, sensitive }));
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
    // What is inside a form control belongs to the control: a `<select>`'s
    // options are what its value may be rather than values of the record, and
    // the control itself is already a `value` source below. Scanning the whole
    // run made this visible -- a run of three labels, each holding a different
    // control, proposed the select's three options as text columns and so
    // stopped reading as the form it is (`detect-structure.ts`,
    // `isFormNotData`).
    if (withinValueControl(item, element)) continue;
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
    } else if (testIdFor(element) !== undefined) {
      sources.push({ kind: "text", label, selector, sensitive });
    } else if (isTextLeaf(element) && !statedMoreTightly(item, element)) {
      sources.push({ kind: "text", label, selector, sensitive });
    }
  }
  return sources;
}

/** Whether the element sits inside a form control of this item, whose contents are the control's own. */
function withinValueControl(item: Element, element: Element): boolean {
  for (let current: Element | null = element.parentElement; current; current = current.parentElement) {
    if (VALUE_TAGS.has(current.tagName.toLowerCase())) return true;
    if (current === item) return false;
  }
  return false;
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
