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
// do not match the attribute rule.
//
// ## What identifies one, strongest first
//
// 1. **A per-instance key**, with the attribute it was read from, so a replay
//    asks the candidate's record for *that* attribute rather than guessing which
//    of several the recording meant. Robust: it survives a restyle, a re-order
//    and a re-render, which is what makes an identity-keyed table safer to
//    replay than a positional one.
// 2. **The record's own text**, bounded, and only when the record was one of
//    several like it at capture time -- where there was nothing to confuse it
//    with, there is nothing to check. Text is the weaker signal and it is a
//    fallback, not a supplement: a keyed record carries no text, so the
//    comparison never degrades to the weaker rule when the stronger one exists.
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
// Nothing here is memoized. Every lookup is bounded by depth, by node count and
// by text length, and the key path -- the common one on a table worth
// protecting -- short-circuits before any text is read.

import { isSensitiveFormControl } from "../element-traits";
import { isWithinSensitiveControl } from "../sensitive-text";
import type { DomElementContext } from "../types";
import { boundedText } from "./bounded-text";

/**
 * The record a recorded element sat in, as it travels on the wire. Declared by
 * the wire contract rather than beside it, so the producer here and the field
 * `shared/protocol.ts` publishes cannot drift apart.
 */
export type RecordIdentity = NonNullable<DomElementContext["record"]>;

/** How far up the tree a record may be. A control sits inside its own row's cell, not ten levels above it. */
const MAX_RECORD_DEPTH = 12;
/** Characters of a record's text kept as its identity. Long enough to separate rows, short enough to be a signal and not a copy of the page. */
const MAX_RECORD_TEXT = 160;
/** Characters of a key. An identifier longer than this is not one. */
const MAX_RECORD_KEY = 120;
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
  if (!record) return undefined;
  const key = recordKey(record);
  if (key) return key;
  if (!repeatedAtCapture(record)) return undefined;
  const text = recordText(record);
  return text ? { text } : undefined;
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
  if (!recorded || (!recorded.key && !recorded.text)) return true;
  const record = enclosingRecord(element);
  if (!record) return false;
  if (recorded.key) {
    const found = recorded.keyAttribute
      ? boundedText(record.getAttribute(recorded.keyAttribute), MAX_RECORD_KEY)
      : recordKey(record)?.key;
    return found === recorded.key;
  }
  return recordText(record) === recorded.text;
}

/** The nearest record at or above the element. The element itself counts: a recorded click on a row *is* the row. */
function enclosingRecord(element: Element): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_RECORD_DEPTH; depth += 1) {
    if (matchesSelector(current, RECORD_SELECTOR) || recordKey(current)) return current;
    current = current.parentElement;
  }
  return undefined;
}

/** The per-instance identifier the author wrote on this record, with the attribute it came from. */
function recordKey(element: Element): RecordIdentity | undefined {
  for (const name of attributeNames(element)) {
    if (!RECORD_KEY_ATTRIBUTE.test(name)) continue;
    const key = boundedText(element.getAttribute(name), MAX_RECORD_KEY);
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

/**
 * The record's own words: its text, less every sensitive control's contents and
 * less every subtree whose words are a control's state rather than the record's
 * identity.
 */
function recordText(record: Element): string | undefined {
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
  return boundedText(text, MAX_RECORD_TEXT);
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
