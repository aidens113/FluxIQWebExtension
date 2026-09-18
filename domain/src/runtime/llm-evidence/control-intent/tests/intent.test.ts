// Whether pressing a control would reveal something or commit something.
//
// The rule these cover replaced an allowlist of ARIA shapes -- a `<summary>`, a
// tab, a menu item -- which refused a plain "New post" button and every row
// checkbox, so on a live slice across three fixtures not one state-changing job
// changed the page: the composer was never opened, so the fields the Flow had
// to fill were never in a packet.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webControlIntent, type WebCommitBasis, type WebRevealBasis } from "../intent";

type Element = Partial<WebLlmEvidenceElement>;

const REVEALS: Array<[what: string, element: Element, basis: WebRevealBasis]> = [
  ["a plain New post button, which is the press that was refused", { tag: "button", controlType: "button", name: "New post" }, "opener"],
  ["a Reply button on a row", { tag: "button", controlType: "button", name: "Reply" }, "opener"],
  ["an Edit button", { tag: "button", controlType: "button", name: "Edit ORD-40100" }, "opener"],
  ["a row menu that says it expands something", { tag: "button", controlType: "button", name: "Order actions", revealKind: "disclosure" }, "disclosure"],
  ["a summary", { tag: "summary", text: "Order details" }, "disclosure"],
  ["a tab", { tag: "div", role: "tab", name: "Scheduled", revealKind: "view" }, "view_switch"],
  ["a tree item", { tag: "li", role: "treeitem", name: "September" }, "view_switch"],
  ["a row's Select checkbox, without which bulk actions never appear", { tag: "input", inputType: "checkbox", name: "Select order ORD-40100" }, "row_selection"],
  ["a select-all checkbox", { tag: "input", inputType: "checkbox", name: "Select all posts" }, "row_selection"],
  ["a link to another page of this site", { tag: "a", name: "ORD-40100", href: "https://shop.test/orders/ORD-40100" }, "page_link"],
  ["a control that puts away what it names", { tag: "button", controlType: "button", name: "Close composer" }, "dismissal"],
];

for (const [what, element, basis] of REVEALS) {
  test(`${what} only reveals`, () => {
    assert.deepEqual(webControlIntent(packetElement(element), page()), { effect: "reveals", basis });
  });
}

// Where the danger is. Every one of these changes state that persists, on
// somebody's real account, and every one stays refused while a Flow is only
// being authored.
const COMMITS: Array<[what: string, element: Element, page: WebLlmPageEvidence, basis: WebCommitBasis]> = [
  ["Send", { tag: "button", controlType: "button", name: "Send" }, page(), "committing_wording"],
  ["Delete", { tag: "button", controlType: "button", name: "Delete order" }, page(), "committing_wording"],
  ["Confirm", { tag: "button", controlType: "button", name: "Confirm" }, page(), "committing_wording"],
  ["Refund", { tag: "button", controlType: "button", name: "Issue refund" }, page(), "committing_wording"],
  ["Dispatch", { tag: "button", controlType: "button", name: "Dispatch run" }, page(), "committing_wording"],
  ["Assign", { tag: "button", controlType: "button", name: "Assign to me" }, page(), "committing_wording"],
  ["Resolve", { tag: "button", controlType: "button", name: "Mark resolved" }, page(), "committing_wording"],
  ["Post", { tag: "button", controlType: "button", name: "Post" }, page(), "committing_wording"],
  ["Save", { tag: "button", controlType: "button", name: "Save draft" }, page(), "committing_wording"],
  // A disclosure that says it deletes is refused for what it says, not for
  // what it is: the wording rung runs before the shape rung for this reason.
  ["a Delete styled as a disclosure", { tag: "button", controlType: "button", name: "Delete", revealKind: "disclosure" }, page(), "committing_wording"],
  ["a logout link", { tag: "a", name: "Sam Okafor", href: "https://social.test/logout" }, page(), "committing_wording"],

  // Structural, where there may be no word to read at all.
  ["an unlabelled submit", { tag: "button", controlType: "submit" }, page(), "submit_control"],
  ["a submit input", { tag: "input", inputType: "submit", name: "Go" }, page(), "submit_control"],
  ["an image input, which submits where it is clicked", { tag: "input", inputType: "image" }, page(), "submit_control"],
  // A `<button>` with no type inside a form is a submit button, whatever it
  // looks like, so exploration never drives a form.
  ["a bare button the page put in a form", { tag: "button", name: "Show more fields", form: "composer-form" }, page(), "form_owned"],

  // A dialog's other buttons are the ones that finish what it asked.
  ["an opener inside a dialog", { tag: "button", controlType: "button", name: "Edit", landmark: "dialog" }, page(), "dialog_open"],
  ["an opener while a modal dialog is up", { tag: "button", controlType: "button", name: "New post" }, page({ dialogs: [{ role: "dialog", modal: true }] }), "dialog_open"],
];

for (const [what, element, context, basis] of COMMITS) {
  test(`${what} commits, and is refused`, () => {
    assert.deepEqual(webControlIntent(packetElement(element), context), { effect: "commits", basis });
  });
}

// The allowlist is what keeps an unknown control unpressed. Committing words
// are a second line, not the only one, so a shape nothing recognises is refused
// even though nothing about it says it commits.
const UNCLEAR: Array<[what: string, element: Element]> = [
  ["an unlabelled button", { tag: "button", controlType: "button" }],
  ["a button whose label says nothing either way", { tag: "button", controlType: "button", name: "Continue" }],
  ["a dropdown, which is filled by the Flow rather than pressed", { tag: "select", name: "Account" }],
  ["a text box", { tag: "input", name: "Search orders" }],
  ["a plain div", { tag: "div", name: "New post" }],
  ["a bare Close with nothing over the page to close", { tag: "button", controlType: "button", name: "Close" }],
];

for (const [what, element] of UNCLEAR) {
  test(`${what} is not recognised, and is refused`, () => {
    assert.deepEqual(webControlIntent(packetElement(element), page()), { effect: "unclear" });
  });
}

// The defect that made an order-management site impossible to explore: the old
// rule matched words against the selector, which this domain assembles from the
// test ids of every ancestor above the element. Every row sat under
// `[data-testid="order-rows"]`, so "order" refused every checkbox, row menu and
// link in the table -- on the one kind of site where orders are the job.
//
// There is no selector to read here at all: `webControlIntent` takes a packet
// element, and the packet carries none. This states the consequence.
test("decides from what the page says and cannot reach a selector", () => {
  const element = packetElement({ tag: "button", controlType: "button", name: "Order actions", revealKind: "disclosure" });

  assert.deepEqual(webControlIntent(element, page()), { effect: "reveals", basis: "disclosure" });
  // The same control with its selector attached -- which only domain code ever
  // holds -- classifies identically, because nothing reads it.
  assert.deepEqual(webControlIntent({ ...element, selector: `[data-testid="order-rows"] tr:nth-child(1) button` } as WebLlmEvidenceElement, page()), {
    effect: "reveals",
    basis: "disclosure",
  });
});

// `page.blockedBy` says some ranked control is painted over by something, which
// a sticky header does on an ordinary dashboard. Read as "a dialog is up" it
// refused every opener on every page with a fixed header; read as "there is
// something to close" it is exactly right.
test("a covered control on the page is something to close, not a dialog to finish", () => {
  const covered = page({ blockedBy: { role: "banner", blocks: 9 } });

  assert.deepEqual(webControlIntent(packetElement({ tag: "button", controlType: "button", name: "New post" }), covered), { effect: "reveals", basis: "opener" });
  assert.deepEqual(webControlIntent(packetElement({ tag: "button", controlType: "button", name: "Close" }), covered), { effect: "reveals", basis: "dismissal" });
});

function packetElement(overrides: Element): WebLlmEvidenceElement {
  return { target: "target.1", tag: "button", ...overrides };
}

function page(overrides: Partial<WebLlmPageEvidence> = {}): WebLlmPageEvidence {
  return {
    schemaVersion: "web-llm-evidence.v2",
    trust: "untrusted-page-evidence",
    location: "https://shop.test/queue",
    elements: [],
    truncated: false,
    ...overrides,
  };
}
