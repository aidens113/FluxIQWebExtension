// Which *record* a control belongs to, and whether a candidate belongs to the
// same one.
//
// ## The defect this closes
//
// Every other signal in `identity/` answers "what kind of control is this?".
// None of them answers "which of the 240 identical ones?", and on a page built
// from a repeated template that is the only question that matters. The member
// directory fixture is the measured case: 240 rows, each with one action button
// carrying the design system's constant `aria-label="Row actions"`, no id, no
// test id, and a generated class shared by all of them. `selector/` can only
// name such a button positionally -- `[data-testid="member-rows"] > tr:nth-of-type(92)
// > td:nth-of-type(7) > button` -- because `element-anchors.ts` knows only an
// id, a test id and a form name, and the row carries none of the three.
//
// Replay that recording against a page the recorded member has left and the
// row at position 92 is *somebody else*. The selector matches exactly one
// element, `veto.ts` scores it against the recording, and every signal agrees:
// same tag, same role, same class set, same accessible name, exactly. The veto
// accepts, the click lands, and the Flow promotes the wrong member and reports
// success (`reports/w2-wrong-row-acted-on.md`). `veto.ts` names that hole in
// its own header -- "an impostor that carries the recorded label exactly
// passes" -- and it is inherent to a fingerprint: nothing *in* two controls a
// page has made identical can tell them apart.
//
// What tells them apart is what is *around* them. So the recording carries the
// identity of the record the control sat in, and a replay checks it.
//
// ## Why not a position, and why not a score
//
// `candidates.ts` explains at length why `listPosition` and `tablePosition` are
// captured but not scored: Core's matcher has no positional signal, and wiring
// one through `attributes` separates two identical row actions by 0.037 against
// a 0.2 margin. That reasoning stands and nothing here changes it. A position
// is also the wrong signal for this defect -- position is exactly what a
// departed member changes -- and a score is the wrong shape. This is a **gate**:
// two records either are the same record or they are not, and a candidate in
// another one is not the recorded control at any score.
//
// ## What counts as a record
//
// Deliberately narrow, because a false positive here is a refusal of a replay
// that would have been right. An ancestor (or the element itself) is a record
// when it is record-shaped -- `tr`, `li`, `article`, or the ARIA roles that say
// the same thing -- or when it carries a per-instance identifier attribute:
// `data-id`, `data-member-id`, `data-row-key`. A `<div>` wrapper is not a
// record, `data-testid` is not a per-instance identifier (a template writes the
// same one on every instance), and `data-sort`, `data-action` and `data-grid`
// do not match the attribute rule. A row's values (below) are also looked for
// in the words a row draws inside an open shadow root, because that is where
// the list extraction read them.
//
// ## What identifies one, strongest first
//
// 1. **A per-instance key**, with the attribute it was read from, so a replay
//    asks the candidate's record for *that* attribute rather than guessing which
//    of several the recording meant. Robust: it survives a restyle, a re-order
//    and a re-render, which is what makes an identity-keyed table safer to
//    replay than a positional one.
// 2. **The record's own text**, whole, and only when the record was one of
//    several like it at capture time -- where there was nothing to confuse it
//    with, there is nothing to check. Text is the weaker signal and it is a
//    fallback, not a supplement: a keyed record carries no text, so the
//    comparison never degrades to the weaker rule when the stronger one exists.
//
// Both name the row the recording was made on. A step inside a For Each runs
// on a different row each pass, so the domain replaces them with the pass's row
// **values** -- what the list extraction read from that row -- and those win
// over both (`holdsRowValues` below, t195). A control in no record is then
// checked against the row its own kind marks out: the part of the page that
// holds it and no other control alike to it (`control-row/`), or, where it
// is itself one tile of a run of same-shaped siblings, against itself
// (`own-run.ts`).
//
// ## A row the page drew as plain markup (t463)
//
// A `<div>` is not a record, and that rule stands. But a control in no record
// whose kind repeats -- bigbox's cart line, each a `<div>` with a select named
// "Qty" -- is recorded by the row its kind marks out, when that row is one of a
// repeated structure (its twin's row a sibling of the same tag and class). It
// carries the row's **title** -- the first heading in it, else the first
// link's words, the item's name on a cart line or a card -- or, where the
// neighbouring row's title is the same, the row's whole words. A replay accepts
// a candidate only where an ancestor holding it and no other alike control is
// titled, or reads whole, as recorded; one in another row, or in a row whose
// words are gone, is refused (`inNamedRow`). Lane B round 8 refused step 27 as
// ambiguous, and its step 26 acted on whichever line a positional selector
// reached (`run-mv5jnc62-01c3609a`).
//
// The text leaves out two kinds of words. A sensitive control's contents, by
// the one rule `sensitive-text.ts` owns (decision D2). And the words inside
// buttons, switches, checkboxes and editable regions -- those say what a
// control is *doing* ("Follow" / "Following"), so including them would refuse
// step two of a Flow because step one changed the row it is still working in.
//
// ## Fail closed
//
// A recording that named a record and a candidate that is in no record at all,
// or in one the recorded attribute is missing from, **disagree**. That is the
// brief's rule and it is the only safe reading: "I cannot tell which record
// this is" is not "it is the right one". The cost is named rather than hidden
// -- a redesign that moves a control out of its row now fails the step instead
// of clicking whatever sits in the row -- and a failed step reaches the
// automation loop, which can look at the page and repair it. A wrong click
// reaches nobody, because it reports success.
//
// Every lookup is bounded by depth and by node count, and the key path -- the
// common one on a table worth protecting -- short-circuits before any text is
// read. Outside a capture scope nothing here is kept. Inside one
// (`withSelectorMemo`) a record's words and a row's title are read once and
// kept for the rest of it (`scoped-memo.ts`), as the climb of `control-row/` is:
// every control in a row asks for the same row's words, and `recordSubject`
// asks for the title of every part of the page above a lone control (t733).
//
// Neither the key nor the text is cut any more (t200). `context.record` rides
// on every descriptor the model is shown, and a record's words cut at 160
// characters were a fragment of the row. A recording made before then carries
// the cut form, so the comparison still accepts a record whose whole words
// begin with it (`sameAsRecorded`).

import { isSensitiveFormControl } from "../element-traits";
import { isWithinSensitiveControl } from "../sensitive-text";
import type { DomElementContext } from "../types";
import { boundedText } from "./bounded-text";
import { controlRow, soleAncestors } from "./control-row";
import { heldAsJoinedLines } from "./joined-row-value";
import { normalizedText } from "./normalized-text";
import { ownRun } from "./own-run";
import { scopedMemo } from "./scoped-memo";
import { parsedUrl } from "../../shared/parsed-url";

/**
 * The record a recorded element sat in, as it travels on the wire. Declared by
 * the wire contract rather than beside it, so the producer here and the field
 * `shared/protocol.ts` publishes cannot drift apart.
 */
export type RecordIdentity = NonNullable<DomElementContext["record"]>;

/** How far up the tree a record may be. A control sits inside its own row's cell, not ten levels above it. */
const MAX_RECORD_DEPTH = 12;
/**
 * Where a recording made before t200 cut a record's text, and its key. Only
 * read to recognise such a recording: nothing is cut here any more.
 */
const LEGACY_RECORD_TEXT_CUT = 160;
const LEGACY_RECORD_KEY_CUT = 120;
/** Nodes walked while reading a record's text. A record is a row, not a document. */
const MAX_RECORD_NODES = 400;

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/** The shapes that are one instance of a repeated thing, in markup and in ARIA. */
const RECORD_SELECTOR = 'tr,li,article,[role="row"],[role="listitem"],[role="option"],[role="treeitem"],[role="article"]';

/**
 * An attribute that names *this* instance: `data-id`, `data-member-id`,
 * `data-row-key`, `data-item-uuid`. The trailing word has to be the whole last
 * hyphen-separated part, so `data-grid` and `data-valid` are not keys, and
 * `data-testid`, `data-test` and `data-cy` are excluded by construction --
 * a template writes the same test id on every instance it renders.
 */
const RECORD_KEY_ATTRIBUTE = /^data-(?:[a-z0-9]+-)*(?:id|key|uid|uuid|guid)$/;

/** Subtrees whose words say what a control is doing rather than which record this is. */
const STATEFUL_SUBTREE = 'button,select,textarea,[role="button"],[role="switch"],[role="checkbox"],[contenteditable]';

/**
 * The record this element belongs to, or `undefined` when it belongs to none
 * that could be told from its neighbours.
 *
 * `undefined` is a statement that no check was recorded, and it is the right
 * answer for most of a page: a form's Save button sits in no record, and
 * inventing one for it would refuse a replay for no reason.
 */
export function recordIdentity(element: Element): RecordIdentity | undefined {
  const record = enclosingRecord(element);
  if (record) {
    const key = recordKey(record);
    if (key) return key;
    const text = repeatedAtCapture(record) ? recordText(record) : undefined;
    if (text) return { text };
  }
  return controlRowIdentity(element);
}

/** The tags a person acts on, whose copy in every row is the wrong-row risk (t463). */
const ROW_CONTROL_TAGS: ReadonlySet<string> = new Set(["button", "select", "textarea", "input", "summary"]);
/** The ARIA roles that say the same thing about an element of any tag. */
const ROW_CONTROL_ROLES: ReadonlySet<string> = new Set([
  "button", "link", "checkbox", "switch", "combobox", "radio", "menuitem", "tab", "spinbutton", "textbox", "searchbox", "slider"
]);

/**
 * A control in no record the page drew, named by the words of the row its own
 * kind marks out (`control-row/`) -- bigbox's cart line, a `<div>` with a
 * "Qty" select in it like every other line's (t463, `run-mv5jnc62-01c3609a`).
 *
 * Only for a control, because only a control is acted on, and because the walk
 * that finds the row runs for every control a snapshot describes and is not
 * worth running for its wrappers and words. Only for a row that is one of a
 * repeated structure: its twin's row is a sibling of the same tag and class,
 * so two unrelated places that happen to hold a "Sign in" each -- a header and
 * a footer -- are not taken for two rows of one list.
 *
 * The words are what a person names the row by (`rowWords`). `undefined` --
 * no gate -- when there is no row, or when the two rows read the same, since
 * then nothing written here could tell them apart.
 */
function controlRowIdentity(element: Element): RecordIdentity | undefined {
  if (!isRowControl(element)) return undefined;
  const found = controlRow(element);
  if (!found || !sameShape(found.row, found.twinRow)) return undefined;
  const text = rowWords(found.row, found.twinRow);
  return text ? { text } : undefined;
}

/** Whether the element is something a person acts on: a form control, a button, a link, or an element whose role says it is one. */
function isRowControl(element: Element): boolean {
  const role = element.getAttribute("role")?.trim().toLowerCase().split(/\s+/u)[0];
  if (role) return ROW_CONTROL_ROLES.has(role);
  const tag = tagOf(element);
  if (tag === "a") return element.hasAttribute("href");
  if (tag === "input") return (element.getAttribute("type") ?? "").toLowerCase() !== "hidden";
  return ROW_CONTROL_TAGS.has(tag);
}

/** Whether two rows are two of one repeated thing: the same tag and the same class attribute. */
function sameShape(row: Element, other: Element): boolean {
  return tagOf(row) === tagOf(other) && (row.getAttribute("class") ?? "") === (other.getAttribute("class") ?? "");
}

/**
 * The words that name a row: its title -- the first heading in it, or failing
 * one, the first link with words, which on a cart line, a result or a card is
 * the item's own name -- when the neighbouring row's title differs; otherwise
 * the row's whole words, when those differ. The title first, because it is the
 * part of a row that does not change while a Flow works in it: a cart line's
 * total moves with its quantity, its product's name does not.
 */
function rowWords(row: Element, twinRow: Element): string | undefined {
  const title = rowTitle(row);
  if (title && title !== rowTitle(twinRow)) return title;
  const whole = recordText(row);
  return whole && whole !== recordText(twinRow) ? whole : undefined;
}

/** Heading tags, whose words title the part of the page they head. */
const HEADING_TAGS: ReadonlySet<string> = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * The row's first heading's words, or its first link's, read as `recordText`
 * reads a record: a sensitive control's contents and a control's state left
 * out. One bounded walk in document order; a heading anywhere wins over a link
 * before it, since a card often leads with a picture link.
 */
function rowTitle(row: Element): string | undefined {
  return rowTitleElement(row)?.words;
}

/** A row's title, read once per capture scope. */
const rowTitles = scopedMemo<Element, { element: Element; words: string } | undefined>();

/** The element `rowTitle` reads, with its words. */
function rowTitleElement(row: Element): { element: Element; words: string } | undefined {
  return rowTitles(row, () => readRowTitle(row));
}

function readRowTitle(row: Element): { element: Element; words: string } | undefined {
  if (isWithinSensitiveControl(row)) return undefined;
  let budget = MAX_RECORD_NODES;
  let link: { element: Element; words: string } | undefined;
  const pending: Node[] = childrenInReverse(row);
  for (let node = pending.pop(); node && budget > 0; node = pending.pop()) {
    budget -= 1;
    if (node.nodeType !== ELEMENT_NODE) continue;
    const child = node as Element;
    if (isSensitiveFormControl(child) || matchesSelector(child, STATEFUL_SUBTREE)) continue;
    const role = child.getAttribute("role")?.trim().toLowerCase();
    if (HEADING_TAGS.has(tagOf(child)) || role === "heading") {
      const words = recordText(child);
      if (words) return { element: child, words };
    }
    if (link === undefined && tagOf(child) === "a" && child.hasAttribute("href")) {
      const words = recordText(child);
      if (words) link = { element: child, words };
    }
    for (const grandchild of childrenInReverse(child)) pending.push(grandchild);
  }
  return link;
}

/**
 * Whether the control sits in the row `words` name: some ancestor that holds it
 * and no other control alike to it reads whole as those words, or is titled by
 * them through a title in the control's own row.
 *
 * The climb is `control-row/`'s, so it stops below the first ancestor that
 * holds a second alike control: the soap line's "Qty" is never weighed by the
 * words of the group that also holds the towels' line. A control with no alike
 * left on the page is weighed by every ancestor in the depth bound, and the
 * title must then be its own row's, not a neighbouring row's (`titleInAnotherRow`):
 * the soap's line, alone in the cart under a towels' line that lost its select,
 * is not the towels' line because the group they share is titled by the towels.
 */
function inNamedRow(control: Element, words: string): boolean {
  for (const ancestor of soleAncestors(control).ancestors) {
    if (recordText(ancestor) === words) return true;
    const title = rowTitleElement(ancestor);
    if (title?.words === words && !titleInAnotherRow(control, title.element)) return true;
  }
  return false;
}

/**
 * Whether the title sits in a row beside the control's rather than in it: where
 * their paths meet, the two children they come through are of one shape -- the
 * same tag and class -- and the control's side has a title of its own that is
 * not this one. Both, because a row is often laid out in columns of one shape,
 * and a column that holds only the control and its label titles nothing.
 */
function titleInAnotherRow(control: Element, title: Element): boolean {
  const controlSide = new Map<Element, Element>();
  let child: Element = control;
  for (let ancestor = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
    controlSide.set(ancestor, child);
    child = ancestor;
  }
  let titleChild: Element = title;
  for (let ancestor = title.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const ownChild = controlSide.get(ancestor);
    if (ownChild) {
      if (ownChild === titleChild || !sameShape(ownChild, titleChild)) return false;
      const own = rowTitle(ownChild);
      return own !== undefined && own !== rowTitle(titleChild);
    }
    titleChild = ancestor;
  }
  return false;
}

/**
 * Whether `element` sits in the record the recording named. `true` when nothing
 * was recorded -- there is no question to answer -- and `false` whenever the
 * question cannot be answered, which is the fail-closed half.
 *
 * The key is asked for by the attribute the recording read it from, so a page
 * carrying two identifier attributes cannot answer the wrong one. A recording
 * from before the attribute travelled carries a bare key; that is compared
 * against whichever key the candidate's record offers, which is weaker and is
 * the only thing left to do with it.
 */
export function agreesWithRecordedRecord(recorded: RecordIdentity | undefined, element: Element): boolean {
  const values = rowValues(recorded?.values);
  if (values.length) return holdsRowValues(enclosingRecord(element) ?? controlRow(element)?.row ?? controlRunRow(element), values);
  if (!recorded || (!recorded.key && !recorded.text)) return true;
  const record = enclosingRecord(element);
  if (recorded.key) {
    if (!record) return false;
    const found = recorded.keyAttribute
      ? normalizedText(record.getAttribute(recorded.keyAttribute))
      : recordKey(record)?.key;
    return sameAsRecorded(found, recorded.key, LEGACY_RECORD_KEY_CUT);
  }
  if (record && sameAsRecorded(recordText(record), recorded.text, LEGACY_RECORD_TEXT_CUT)) return true;
  // A row the page drew as plain markup was recorded by its words (t463); a
  // record's text that disagreed above may still be that row's.
  return recorded.text !== undefined && inNamedRow(element, recorded.text);
}

/**
 * Whether what the candidate's record says is what the recording said. Equal,
 * or -- for a recording made while keys and text were still cut -- a recorded
 * value exactly as long as that cut which the candidate's whole value begins
 * with, which is the only reading that cut value can have had.
 */
function sameAsRecorded(found: string | undefined, recorded: string | undefined, legacyCut: number): boolean {
  if (found === undefined || recorded === undefined) return false;
  if (found === recorded) return true;
  return recorded.length === legacyCut && found.length > legacyCut && found.slice(0, legacyCut) === recorded;
}

/** Characters of a record's text searched for a row's values. A card, however long its description, says which it is well before this. */
const MAX_ROW_TEXT = 4_000;
/** Nodes walked while reading a record for a row's values: text and elements, both. */
const MAX_ROW_NODES = 2_000;
/** Characters of one row value, as the domain cut it (`output-nodes/targets` `webAutomationRecordValues`). */
const MAX_ROW_VALUE = 200;
/**
 * Elements whose text a shadow root carries but never draws -- a component's
 * own stylesheet above all -- which the field reader leaves out too
 * (`content/extraction/field-reader.ts` `UNDRAWN_TAGS`).
 */
const UNDRAWN_TAGS: ReadonlySet<string> = new Set(["style", "script", "template", "noscript"]);

/**
 * Whether a record is the row a For Each pass is on (t195).
 *
 * The domain writes `values` from the loop's current item: the values the list
 * extraction read out of that row (`domain/src/output-nodes/native-runtime.ts`).
 * They take precedence over `key` and `text`, which name the row the Flow was
 * built on -- asked on pass two, those accept only the first row's control,
 * which is the defect: every pass pressed the first card's button.
 *
 * Each value must be found in the record, by the ways the extraction can have
 * read it (`content/extraction/field-reader.ts`): inside its text, which is the
 * record's own words *including* its buttons' (a field may read one), bounded
 * and whitespace-collapsed; equal to the resolved `href` of a link in it, which
 * is how a `link` field reads; or equal to an attribute value on the record or
 * inside it -- an `attribute` field, a microdata `content`, an `aria-label` --
 * or a form control's current value. Every value, not most: a row is told from
 * its neighbours by the values it does not share with them. A value read as
 * joined lines -- a `lines` field, each drawn child one line -- is found when
 * each of its lines is, in this same record (`joined-row-value.ts`): the
 * separator is the extraction's, and the page never draws it.
 *
 * Fail closed as the rest of this module does: a candidate in neither a record
 * nor a row of its own, a record inside a sensitive control, and a value the
 * bounded read did not reach all disagree. A step refused on the right row reaches the automation loop; a
 * press on the wrong one reports success.
 */
function holdsRowValues(record: Element | undefined, values: readonly string[]): boolean {
  if (!record || isWithinSensitiveControl(record)) return false;
  const { text, exact } = rowContents(record);
  const holds = (value: string): boolean => text.includes(value) || exact.has(value);
  return values.every((value) => holds(value) || heldAsJoinedLines(value, holds));
}

/** The recorded values as this module compares them: each collapsed and cut the way the domain cut it, empties dropped. */
function rowValues(values: readonly unknown[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    const text = typeof value === "string" ? rowValue(value) : undefined;
    return text ? [text] : [];
  });
}

/** One string collapsed, trimmed and cut at the row-value bound, as `webAutomationRecordValues` writes one. */
function rowValue(value: string): string | undefined {
  return boundedText(value, MAX_ROW_VALUE)?.trimEnd();
}

/**
 * What a record says, for finding a row's values in: its collapsed text up to
 * `MAX_ROW_TEXT`, and every attribute value, resolved link and control value on
 * it or inside it, each cut as a row value is. One bounded walk reads both; a
 * sensitive control is skipped whole, its text, attributes and value alike
 * (decision D2), because a list extraction refuses to read one too.
 *
 * The walk enters every open shadow root it meets, after the host's light
 * children so the stack visits it first, at the host's place in the text: the
 * extraction reads what a component draws there (Guildline's `gl-time-ago`
 * says "Sent 1 month ago" only in its shadow root), so a row whose value came
 * from one is found by it. A stylesheet, script or template in a shadow root
 * is not drawn and is skipped, so it neither matches a value nor spends the
 * text bound. The light tree is read exactly as it was.
 */
function rowContents(record: Element): { text: string; exact: Set<string> } {
  const exact = new Set<string>();
  let text = "";
  let budget = MAX_ROW_NODES;
  const pending: RowNode[] = [{ node: record, shadow: false }];
  for (let next = pending.pop(); next && budget > 0; next = pending.pop()) {
    budget -= 1;
    const { node, shadow } = next;
    if (node.nodeType === TEXT_NODE) {
      if (text.length < MAX_ROW_TEXT * 2) text += node.nodeValue ?? "";
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const element = node as Element;
    if (isSensitiveFormControl(element) || (shadow && UNDRAWN_TAGS.has(tagOf(element)))) continue;
    for (const found of elementValues(element)) {
      const value = rowValue(found);
      if (value) exact.add(value);
    }
    for (const child of childrenInReverse(element)) pending.push({ node: child, shadow });
    const root = element.shadowRoot;
    if (root) for (const child of childrenInReverse(root)) pending.push({ node: child, shadow: true });
  }
  return { text: boundedText(text, MAX_ROW_TEXT) ?? "", exact };
}

/** A node waiting in `rowContents`'s walk, and whether it sits in a shadow tree. */
type RowNode = { node: Node; shadow: boolean };

/** An element's attribute values, its resolved link and its current control value: the non-text places a field reads. */
function elementValues(element: Element): string[] {
  const found: string[] = [];
  for (const name of attributeNames(element)) {
    const value = element.getAttribute(name);
    if (value) found.push(value);
  }
  const href = resolvedHref(element);
  if (href) found.push(href);
  const value = (element as { value?: unknown }).value;
  if (typeof value === "string" && value) found.push(value);
  return found;
}

/**
 * The link an element names, absolute, as the extraction's `link` field reads
 * it. An HTML link answers through its own `href`; any other element's `href`
 * attribute is resolved against its base, and one that is no URL is simply not
 * a link -- its raw text is still among the attribute values above.
 */
function resolvedHref(element: Element): string | undefined {
  const property = (element as { href?: unknown }).href;
  if (typeof property === "string") return property || undefined;
  const attribute = element.getAttribute("href");
  if (!attribute) return undefined;
  return parsedUrl(attribute, element.baseURI)?.href;
}

/**
 * Whether the element is one instance of a repeated thing by the rule above:
 * record-shaped markup or ARIA, or a per-instance identifier attribute.
 *
 * Exported for the snapshot's repeat annotation (`../repeat-exemplars.ts`),
 * which asks the same question for a different reason -- which controls are
 * one per row -- and must not answer it by a second rule.
 */
export function isRecordElement(element: Element): boolean {
  return matchesSelector(element, RECORD_SELECTOR) || recordKey(element) !== undefined;
}

/**
 * Whether the element sits in one row of several like it (`repeatedRowOf`). A
 * loop pass asks it of the answer a control resolved to anywhere on the page
 * (`../action-runtime/pass-row/`): an answer in another row of a list is
 * another row's control, not a page-level one the pass may act on as it is.
 */
export function sitsInRepeatedRow(element: Element): boolean {
  return repeatedRowOf(element) !== undefined;
}

/**
 * The row of several like it that the element sits in, or `undefined` when it
 * sits in none: the nearest record at or above it, within the record depth
 * bound, that has a sibling of its own tag -- a card's `article` alone in its
 * `li` is not that row, the `li` beside the other `li`s is (F2 note 2) -- or,
 * for a control in no such record, the row its own kind marks out, whose twin
 * row has the same shape (`controlRowIdentity`'s rule), or the control itself
 * as one of a run of same-shaped siblings that carry and differ in content --
 * a gallery's tile (`own-run.ts`).
 *
 * Read on the page as it is now, by the same rules a recording names a record
 * by, so a control a recording would have placed in a row is in one here.
 */
export function repeatedRowOf(element: Element): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_RECORD_DEPTH; depth += 1) {
    if (isRecordElement(current) && repeatedAtCapture(current)) return current;
    current = current.parentElement;
  }
  if (!isRowControl(element)) return undefined;
  const found = controlRow(element);
  if (found !== undefined && sameShape(found.row, found.twinRow)) return found.row;
  return ownRun(element) ? element : undefined;
}

/** The control itself as its own row, when it is a control and one of a run of same-shaped siblings (`own-run.ts`). */
function controlRunRow(element: Element): Element | undefined {
  return isRowControl(element) && ownRun(element) ? element : undefined;
}

/**
 * What the element is about, in the words a person names it by (FluxIQ Core
 * t719), or `undefined` where nothing here can say.
 *
 * Core ties an undo of a build's own act to that act's own item, and an act
 * whose effect shows elsewhere had none an undo there could match: an Add to
 * Cart pressed on a detail page sits in no row, and the line it made appears in
 * the basket; a Save for later moves its line to another list, whose control is
 * another one. Every such undo was refused and the build's trials ran on what
 * earlier trials left. What ties them is what both are about, so:
 *
 * - a heading is about its own words (the domain reads a page's main heading
 *   as what the page is about, which a detail page's own controls act on);
 * - a control in a record, or in the row its own kind marks out, is about that
 *   row's title -- the first heading in it, else its first link's words, which
 *   on a basket line, a result or a card is the item's own name -- but only
 *   where that title tells the row from its neighbour's: two rows titled alike
 *   say nothing of which one is meant;
 * - a control alone of its kind on the page -- a detail page's Add to Cart, a
 *   saved list's only Move to cart -- is about the title of the nearest part of
 *   the page around it that has one. Alone, there is no other row it could be
 *   confused with. One with an alike control elsewhere but no row of its own
 *   to tell them apart is about nothing.
 *
 * The words never leave the domain: it digests them, and Core compares the
 * digests only for equality.
 */
export function recordSubject(element: Element): string | undefined {
  if (HEADING_TAGS.has(tagOf(element)) || element.getAttribute("role")?.trim().toLowerCase() === "heading") return recordText(element);
  const record = enclosingRecord(element);
  if (record) return distinctTitle(record, sameTagSibling(record));
  const found = controlRow(element);
  if (found) return distinctTitle(found.row, found.twinRow);
  if (soleAncestors(element).twin) return undefined;
  return nearestTitle(element);
}

/** The row's title, where it differs from its neighbour's (`recordSubject`); a lone row's title as it is. */
function distinctTitle(row: Element, neighbour: Element | undefined): string | undefined {
  const title = rowTitle(row);
  return title !== undefined && (neighbour === undefined || rowTitle(neighbour) !== title) ? title : undefined;
}

/** A sibling of the record with its tag, the record's neighbour in its list, if it has one. */
function sameTagSibling(record: Element): Element | undefined {
  for (const sibling of record.parentElement?.children ?? []) {
    if (sibling !== record && tagOf(sibling) === tagOf(record)) return sibling;
  }
  return undefined;
}

/**
 * The title of the nearest part of the page above the element that has one,
 * within the record depth bound -- or none, failing closed, when that title
 * sits in a part beside the element's that is shaped like it
 * (`inSiblingOfOwnShape`): a line with no title of its own is not about its
 * neighbour.
 */
function nearestTitle(element: Element): string | undefined {
  let current = element.parentElement;
  for (let depth = 0; current && depth < MAX_RECORD_DEPTH; depth += 1) {
    const title = rowTitleElement(current);
    if (title) return inSiblingOfOwnShape(element, title.element) ? undefined : title.words;
    current = current.parentElement;
  }
  return undefined;
}

/**
 * Whether `title` sits beside `element` in a sibling part of the same shape:
 * where their paths meet, they come through two different children of one
 * tag and class, as two rows of one list do. Stricter than
 * `titleInAnotherRow`, which a row with no title of its own passes: a subject
 * must be the element's own part's, or the page's around it.
 */
function inSiblingOfOwnShape(element: Element, title: Element): boolean {
  const elementSide = new Map<Element, Element>();
  let child: Element = element;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    elementSide.set(ancestor, child);
    child = ancestor;
  }
  let titleChild: Element = title;
  for (let ancestor = title.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const ownChild = elementSide.get(ancestor);
    if (ownChild) return ownChild !== titleChild && sameShape(ownChild, titleChild);
    titleChild = ancestor;
  }
  return false;
}

/** The nearest record at or above the element. The element itself counts: a recorded click on a row *is* the row. */
function enclosingRecord(element: Element): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_RECORD_DEPTH; depth += 1) {
    if (isRecordElement(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

/** The per-instance identifier the author wrote on this record, with the attribute it came from. */
function recordKey(element: Element): RecordIdentity | undefined {
  for (const name of attributeNames(element)) {
    if (!RECORD_KEY_ATTRIBUTE.test(name)) continue;
    const key = normalizedText(element.getAttribute(name));
    if (key) return { keyAttribute: name, key };
  }
  return undefined;
}

/**
 * Whether the page held more than one of these when the recording was made.
 * Only then is there anything for the weaker text rule to protect against, and
 * a lone record whose words later change must not fail a replay that is right.
 */
function repeatedAtCapture(record: Element): boolean {
  const parent = record.parentElement;
  if (!parent) return false;
  for (const sibling of parent.children) {
    if (sibling !== record && tagOf(sibling) === tagOf(record)) return true;
  }
  return false;
}

/** A record's words, read once per capture scope. */
const recordTexts = scopedMemo<Element, string | undefined>();

/**
 * The record's own words: its text, less every sensitive control's contents and
 * less every subtree whose words are a control's state rather than the record's
 * identity.
 */
function recordText(record: Element): string | undefined {
  return recordTexts(record, () => readRecordText(record));
}

function readRecordText(record: Element): string | undefined {
  if (isWithinSensitiveControl(record)) return undefined;
  let budget = MAX_RECORD_NODES;
  let text = "";
  const pending: Node[] = childrenInReverse(record);
  for (let node = pending.pop(); node && budget > 0; node = pending.pop()) {
    budget -= 1;
    if (node.nodeType === TEXT_NODE) {
      text += node.nodeValue ?? "";
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const child = node as Element;
    if (isSensitiveFormControl(child) || matchesSelector(child, STATEFUL_SUBTREE)) continue;
    for (const grandchild of childrenInReverse(child)) pending.push(grandchild);
  }
  return normalizedText(text);
}

/** A node's children, last first, so a stack walks them in document order. */
function childrenInReverse(node: Node): Node[] {
  const children = node.childNodes;
  const reversed: Node[] = [];
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child) reversed.push(child);
  }
  return reversed;
}

/** The element's attribute names, or none when the host cannot list them. */
function attributeNames(element: Element): readonly string[] {
  return typeof element.getAttributeNames === "function" ? element.getAttributeNames() : [];
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}

/** `matches`, which throws on a selector a host does not support and is absent on a bare stub. */
function matchesSelector(element: Element, selector: string): boolean {
  try {
    return typeof element.matches === "function" && element.matches(selector);
  } catch {
    return false;
  }
}
