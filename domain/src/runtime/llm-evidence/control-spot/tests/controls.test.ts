// A stateful control's own place and state (L1 reset settlement, "Control
// states"): a toggle keeps its place while its state flips, the same control
// shown in a dialog over a page and on that page itself is at one place, and a
// row's toggle is at its row's place. The site is a recipe notebook: notes a
// cook stars, and a note opened over the notebook or on its own page.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webControlPlace, webControlState, webControlStates, webResetResource, webTargetSpot } from "..";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../sanitize";

const NOTE = "https://notebook.test/notes/41/";

/** A binding of `elements` at `url`, read from tab 1's top frame of one session. */
function page(elements: JsonObject[], url = NOTE, source = "tab:1:frame:0"): WebLlmSnapshotBinding {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url, title: "Notebook", interactiveElements: elements });
  binding.resetResource = webResetResource("session", source)!;
  return binding;
}

/** The handle of the element `selector` addresses on `binding`. */
function handleOf(binding: WebLlmSnapshotBinding, selector: string): string {
  const handle = [...binding.selectors].find(([, written]) => written === selector)?.[0];
  assert.ok(handle, `no element at ${selector}`);
  return handle;
}

const star = (selector: string, name: string, extra: JsonObject = {}): JsonObject => ({ tagName: "div", role: "button", selector, accessibleName: name, ...extra });

test("only visible stateful controls have a place: buttons, checkboxes, tabs and anything stating a pressed, checked or selected state", () => {
  const binding = page([
    { tagName: "a", selector: "#home", accessibleName: "Home", href: "/" },
    { tagName: "p", selector: "#intro", visibleText: "Weeknight soups" },
    { tagName: "button", implicitRole: "button", selector: "#print", accessibleName: "Print" },
    { tagName: "input", implicitRole: "checkbox", inputType: "checkbox", selector: "#done", checked: false, accessibleName: "Cooked" },
    { tagName: "div", role: "tab", selector: "#steps", accessibleName: "Steps" },
    { tagName: "span", selector: "#pin", accessibleName: "Pin", attributes: { "aria-pressed": "false" } },
    star("#hidden-star", "Star", { hidden: true })
  ]);
  const placed = (selector: string) => webControlPlace(binding, handleOf(binding, selector)) !== undefined;
  assert.deepEqual(["#home", "#intro", "#print", "#done", "#steps", "#pin", "#hidden-star"].map(placed), [false, false, true, true, true, true, false]);
  const counts = Object.values(webControlStates(binding)).reduce((sum, states) => sum + Object.values(states).reduce((a, b) => a + b, 0), 0);
  assert.equal(counts, 4, "the hidden star is not counted");
  // No trusted source: no place at all.
  const untrusted = sanitizeWebLlmSnapshotWithBindings({ url: NOTE, title: "Notebook", interactiveElements: [star("#star", "Star")] });
  assert.equal(webControlPlace(untrusted, handleOf(untrusted, "#star")), undefined);
  assert.deepEqual(webControlStates(untrusted), {});
});

test("a toggle's state changes with its press while its place stays", () => {
  const before = page([star("#star", "Star", { attributes: { "aria-pressed": "false" } })]);
  const after = page([star("#star", "Unstar", { attributes: { "aria-pressed": "true" } })]);
  const was = webTargetSpot(before, handleOf(before, "#star")), now = webTargetSpot(after, handleOf(after, "#star"));
  assert.ok(was.place && was.state);
  assert.equal(now.place, was.place);
  assert.notEqual(now.state, was.state);
  assert.deepEqual(webControlStates(before), { [was.place]: { [was.state]: 1 } });
  assert.deepEqual(webControlStates(after), { [was.place]: { [now.state!]: 1 } });
  // Opaque tokens Core's reader takes, without the control's words.
  for (const token of [was.place, was.state]) {
    assert.match(token, /^p:[0-9a-f]{32}$/u);
    assert.ok(!token.includes("Star"));
  }
  // A checkbox's checked state is its state too.
  const box = (checked: boolean) => page([{ tagName: "input", implicitRole: "checkbox", inputType: "checkbox", selector: "#done", checked, accessibleName: "Cooked" }]);
  const unchecked = box(false), checked = box(true);
  assert.notEqual(webControlState(unchecked.evidence.elements[0]!), webControlState(checked.evidence.elements[0]!));
  assert.equal(webControlPlace(unchecked, handleOf(unchecked, "#done")), webControlPlace(checked, handleOf(checked, "#done")));
});

test("the same control shown in a dialog over a page and on its own page is at one place", () => {
  // The notebook opens note 41 in a dialog and puts the note's address in the location bar.
  const inDialog = page([
    { tagName: "main", selector: "main" },
    { tagName: "a", selector: "main > a", accessibleName: "Lentil soup", href: "/notes/41/", parent: 0 },
    { tagName: "div", role: "dialog", selector: "body > div.modal", accessibleName: "Lentil soup" },
    { tagName: "article", selector: "body > div.modal > article", parent: 2, context: { dialog: "Lentil soup" } },
    star("body > div.modal > article > section > div", "Star", { parent: 3, context: { dialog: "Lentil soup", subject: "Lentil soup" } })
  ]);
  const ownPage = page([
    { tagName: "main", selector: "main" },
    { tagName: "article", selector: "main > article", parent: 0 },
    star("main > article > section > div", "Unstar", { parent: 1, context: { subject: "Lentil soup" } })
  ]);
  const dialogStar = webTargetSpot(inDialog, handleOf(inDialog, "body > div.modal > article > section > div"));
  const pageStar = webTargetSpot(ownPage, handleOf(ownPage, "main > article > section > div"));
  assert.ok(dialogStar.dialog && !pageStar.dialog, "the dialog is no part of the place");
  assert.equal(pageStar.place, dialogStar.place);
  assert.notEqual(pageStar.state, dialogStar.state);
  // Another page, or another tab, is another place.
  const otherNote = page([star("main > article > section > div", "Star")], "https://notebook.test/notes/42/");
  assert.notEqual(webControlPlace(otherNote, handleOf(otherNote, "main > article > section > div")), pageStar.place);
  const otherTab = page([star("main > article > section > div", "Star")], NOTE, "tab:2:frame:0");
  assert.notEqual(webControlPlace(otherTab, handleOf(otherTab, "main > article > section > div")), pageStar.place);
});

test("a control in a record is at its record's place: one per titled row, and never the page's own", () => {
  const SEP = String.fromCharCode(31);
  const row = (n: number, title: string | undefined, record: string): JsonObject[] => [
    { tagName: "li", selector: `#notes > li:nth-of-type(${n})`, context: { record: { text: record } } },
    star(`#notes > li:nth-of-type(${n}) > div`, "Star", { context: title === undefined ? { record: { text: record } } : { record: { text: record }, subject: title } })
  ];
  const binding = page([
    star("#page-star", "Star", { context: { subject: "Lentil soup" } }),
    ...row(1, "Barley stew", "Barley stew 2 days ago"),
    ...row(2, "Pea soup", "Pea soup 3 days ago"),
    ...row(3, undefined, "Untitled 4 days ago"),
    ...row(4, undefined, "Untitled 5 days ago")
  ]);
  const at = (selector: string) => webControlPlace(binding, handleOf(binding, selector));
  const own = at("#page-star"), barley = at("#notes > li:nth-of-type(1) > div"), pea = at("#notes > li:nth-of-type(2) > div");
  const untitled = at("#notes > li:nth-of-type(3) > div");
  assert.equal(new Set([own, barley, pea, untitled]).size, 4, "the page's star, each titled row's and an untitled row's are four places");
  assert.equal(at("#notes > li:nth-of-type(4) > div"), untitled, "rows titled by nothing share one place, counted together");
  const states = webControlStates(binding);
  assert.deepEqual(Object.values(states[untitled!]!), [2]);
  assert.doesNotMatch(JSON.stringify(states), new RegExp(`Barley|Untitled|${SEP}`, "u"));
});

// l1 D5: a toggle the page drew only as an icon. The extension names it by the
// drawing it holds (`apps/extension/src/content/identity/accessible-name.ts`),
// so a pin whose icon's label flips arrives as two names; one the page named
// nowhere but in a tooltip is read by the words the page view prints for it.
test("an icon-only toggle's two states are two state tokens at one place", () => {
  const pin = (name: string, label: string) => page([
    { tagName: "div", role: "button", selector: "#pin", accessibleName: name },
    { tagName: "svg", role: "img", selector: "#pin > svg", accessibleName: label, parent: 0 }
  ]);
  const before = pin("Pin note", "Pin note"), after = pin("Unpin note", "Unpin note");
  const was = webTargetSpot(before, handleOf(before, "#pin")), now = webTargetSpot(after, handleOf(after, "#pin"));
  assert.ok(was.place && was.state && now.state);
  assert.equal(now.place, was.place);
  assert.notEqual(now.state, was.state);
});

test("a control with no name is read by the words the page view prints for it, and wordless controls at one place still count together", () => {
  const tipped = (tip: string) => page([{ tagName: "div", role: "button", selector: "#pin", attributes: { class: "pin", "data-tooltip": tip } }]);
  const before = tipped("Pin note"), after = tipped("Unpin note");
  assert.equal(before.evidence.elements[0]!.name, undefined, "the fixture gives the control no name");
  const was = webTargetSpot(before, handleOf(before, "#pin")), now = webTargetSpot(after, handleOf(after, "#pin"));
  assert.ok(was.place && was.state && now.state);
  assert.equal(now.place, was.place);
  assert.notEqual(now.state, was.state, "the tooltip the view prints tells the two states apart");
  // The same words as a name or as the printed fallback are one state: the token reads what the control says.
  const named = page([{ tagName: "div", role: "button", selector: "#pin", accessibleName: "Pin note" }]);
  assert.equal(webTargetSpot(named, handleOf(named, "#pin")).state, was.state);
  // Two controls with no words at all share one place and one state, counted twice.
  const blank = page([
    { tagName: "div", role: "button", selector: "#a", attributes: { class: "dot" } },
    { tagName: "div", role: "button", selector: "#b", attributes: { class: "dot" } }
  ]);
  assert.deepEqual(Object.values(webControlStates(blank)).map((states) => Object.values(states)), [[2]]);
});
