// An icon badge as a column: an element with no words of its own that the page
// names for assistive technology, and the name a column reading it may be
// labelled with.
//
// **Until 2026-09-29 no such element was a column at all.** The everything
// store marks a Plus-eligible listing with `<i role="img" aria-label="Brightaisle
// Plus"></i>` and nothing else. Detection offered images, links, form controls,
// test ids and elements with words (`infer-fields.ts`), so the badge matched
// none of them, and an instruction asking for "Brightaisle Plus eligible"
// earbuds had no column to put `where {field, is: "present"}` on
// (`docs/working/language-driven-flow-loop-plan/reports/t194-w3-extract-conditions.md`, Q2).
//
// **Its label is its accessible name when that name is the same in every item
// that carries the element**, and otherwise it keeps its path label. A model is
// shown a column's label and never its values (D3); a path through hashed class
// names says nothing about which column means "Plus", so a model has to guess.
// A name that is the same on every card that has it is page chrome, in the way
// a button's caption is, and the model is already shown button captions as
// accessible names. It is not a record's value, because no record differs by it
// -- only by whether it is there, which is exactly what the column then says.
// A name that differs between items is per-record data (a rating icon's "4.5
// out of 5 stars"), and it is never used as a label. Nor is a name seen in
// fewer than two items, where "the same in every item" cannot be told from one
// record's value.
//
// Where the name comes from, in the order the accessible-name computation asks:
// `aria-label` (which covers `role="img"` with one), then `title`, then an
// `<svg>`'s own `<title>` child. An element the page hid from assistive
// technology (`aria-hidden="true"`) has no accessible name and is not a badge.

import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";

/** How a badge states its name: an attribute of the element, or the `<title>` child of an `<svg>`. */
export type BadgeNaming = { attribute: string } | { title: Element };

/** The attributes that name an element, in the order its accessible name is computed from them. */
const NAME_ATTRIBUTES: readonly string[] = ["aria-label", "title"];

/** A badge needs its name in at least this many items before the name may be a label. */
const MIN_NAMED_ITEMS = 2;

/**
 * How the element states its accessible name, when it is a badge: it has a
 * name and no words of its own. An `<svg>`'s words are its drawing's -- a
 * `<title>` or `<text>` -- so an `<svg>` is judged by its name alone.
 * `undefined` for anything else, which is every element that has words.
 */
export function badgeNaming(element: Element): BadgeNaming | undefined {
  if (element.getAttribute("aria-hidden") === "true") return undefined;
  const svg = element.tagName.toLowerCase() === "svg";
  const attribute = NAME_ATTRIBUTES.find((name) => collapsed(element.getAttribute(name) ?? "") !== "");
  if (attribute === undefined && !svg) return undefined;
  if (!svg && collapsed(textOutsideSensitiveControls(element)) !== "") return undefined;
  if (attribute !== undefined) return { attribute };
  const title = Array.from(element.children).find((child) => child.tagName.toLowerCase() === "title" && collapsed(textOutsideSensitiveControls(child)) !== "");
  return title === undefined ? undefined : { title };
}

/**
 * The name every item that has the badge gives it, or `undefined` when two
 * items name it differently, when an item has the element without a name, when
 * fewer than two items have it at all, or when it sits inside a sensitive
 * control. `attribute` is the attribute the name is read from; absent, it is the
 * element's own text, which is how an `<svg>`'s `<title>` is read.
 *
 * The names are compared and one of them returned; none is kept anywhere else.
 */
export function constantBadgeName(run: readonly Element[], selector: string, attribute: string | undefined): string | undefined {
  let name: string | undefined;
  let named = 0;
  // The selector is one detection built and has already run in every item to
  // measure coverage, so a throw here is a fault, not a badge without a name.
  for (const item of run) {
    const element = item.querySelector(selector);
    if (element === null) continue;
    if (isWithinSensitiveControl(element)) return undefined;
    const stated = collapsed(attribute === undefined ? textOutsideSensitiveControls(element) : element.getAttribute(attribute) ?? "");
    if (stated === "" || (name !== undefined && stated !== name)) return undefined;
    name = stated;
    named += 1;
  }
  return named >= MIN_NAMED_ITEMS ? name : undefined;
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
