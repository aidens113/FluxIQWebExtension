import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedWebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webRecoverySafeActionVerdict, type WebRecoverySafetyRung } from "../safety";

// Decision L3, which is not negotiable: the destructive refusal is semantic --
// submit, delete-like, control role and type -- and never a similarity score.
// Each row below is a statement about what the control is for.
const REFUSALS: Array<[string, Partial<ResolvedWebLlmEvidenceElement>, WebRecoverySafetyRung]> = [
  ["a button whose name says it deletes", { name: "Delete account", role: "button" }, "committing_wording"],
  ["a button whose visible text says it pays", { text: "Pay now", role: "button" }, "committing_wording"],
  ["a named button nothing corroborates, whatever its selector says", { selector: "#submit-order", name: "Continue", role: "button" }, "unidentified_without_corroboration"],
  ["a delete styled as an ordinary dialog button", { name: "Delete", role: "button", landmark: "dialog" }, "committing_wording"],
  ["an unlabelled submit control", { tag: "input", controlType: "submit" }, "submit_control"],
  ["an unlabelled submit input type", { tag: "input", inputType: "submit" }, "submit_control"],
  ["any control the page put in a form", { name: "Close", role: "button", form: "checkout" }, "form_owned"],
  ["a link, which is navigation and not a click", { tag: "a", name: "Close", href: "https://example.test/x" }, "not_an_actionable_control"],
  ["a text input", { tag: "input", name: "Close" }, "not_an_actionable_control"],
  ["a named button nothing about the page corroborates", { tag: "button", name: "Details" }, "unidentified_without_corroboration"],
  ["an unlabelled button with only one agreeing signal", { tag: "button", landmark: "dialog" }, "unidentified_without_corroboration"]
];

for (const [label, overrides, rung] of REFUSALS) {
  test(`refuses ${label}`, () => {
    const verdict = webRecoverySafeActionVerdict(element(overrides), page());

    assert.deepEqual(verdict, { ok: false, code: "target_unsafe", rung });
  });
}

test("clears a named dismissal in a modal, and says what it rested on", () => {
  const verdict = webRecoverySafeActionVerdict(element({ tag: "button", name: "Close", landmark: "dialog" }), page({ dialogs: [{ role: "dialog", modal: true }] }));

  assert.deepEqual(verdict, { ok: true, identified: true, signals: ["dismissal_wording", "modal_dialog", "dialog_landmark"] });
});

test("clears a named view switch, because switching a view commits nothing", () => {
  const verdict = webRecoverySafeActionVerdict(element({ tag: "div", role: "tab", name: "Details", revealKind: "view" }), page());

  assert.deepEqual(verdict, { ok: true, identified: true, signals: ["view_switch"] });
});

test("clears a named disclosure on its own reversibility", () => {
  const verdict = webRecoverySafeActionVerdict(element({ tag: "button", name: "More options", revealKind: "disclosure" }), page());

  assert.deepEqual(verdict, { ok: true, identified: true, signals: ["reversible_disclosure"] });
});

// L3's second clause, both halves. The bar goes up when there is nothing to
// read on the control, and it goes up rather than being waived.
test("lets an unlabelled control through only when two independent things agree", () => {
  const unlabelled = element({ tag: "button", landmark: "dialog" });

  const alone = webRecoverySafeActionVerdict(unlabelled, page());
  const corroborated = webRecoverySafeActionVerdict(unlabelled, page({ blockedBy: { role: "dialog", blocks: 12 } }));

  assert.equal(alone.ok, false);
  assert.deepEqual(corroborated, { ok: true, identified: false, signals: ["modal_dialog", "dialog_landmark"] });
});

// The regression this ladder exists to stop: a candidate that looks exactly
// like the control that used to be there, and means something else entirely.
// Nothing in the verdict consults a score, a fingerprint or a recorded element,
// so a perfect resemblance changes nothing.
test("refuses a delete that took the place of the recorded control, however alike they look", () => {
  const recorded = { tag: "button", role: "button", name: "Details", landmark: "dialog", selector: "#row-3 > button" };
  const replacement = { ...recorded, name: "Delete" };
  const context = page({ dialogs: [{ role: "dialog", modal: true }] });

  assert.equal(webRecoverySafeActionVerdict(element(recorded), context).ok, true);
  assert.deepEqual(webRecoverySafeActionVerdict(element(replacement), context), { ok: false, code: "target_unsafe", rung: "committing_wording" });
});

// The selector is this domain's address for an element, assembled from the test
// ids of every ancestor above it. Reading it made an order-management fixture
// impossible to explore: every row sits under `[data-testid="order-rows"]`, so
// the word "order" refused every control in the table, on the one kind of site
// where orders are the job. The label is what a person reads; the selector is
// not something the page says to anybody.
test("reads the label and never the selector, so a word in an ancestor's test id refuses nothing", () => {
  const context = page({ dialogs: [{ role: "dialog", modal: true }] });
  const inTheOrdersTable = { tag: "button", name: "Close", landmark: "dialog", selector: `[data-testid="order-rows"] tr:nth-child(1) button` };

  assert.equal(webRecoverySafeActionVerdict(element(inTheOrdersTable), context).ok, true);
  // And the same control, still under that selector, refused the moment its own
  // label commits.
  assert.deepEqual(
    webRecoverySafeActionVerdict(element({ ...inTheOrdersTable, name: "Cancel order" }), context),
    { ok: false, code: "target_unsafe", rung: "committing_wording" }
  );
});

test("every committing word is refused on the same rung, so none of them depends on where it appears", () => {
  for (const word of ["Submit", "Save", "Apply", "Confirm", "Purchase", "Checkout", "Transfer", "Delete", "Remove", "Reset", "Unsubscribe", "Send", "Publish", "Upload", "Accept"]) {
    const verdict = webRecoverySafeActionVerdict(element({ tag: "button", name: `${word} it`, landmark: "dialog" }), page({ dialogs: [{ role: "dialog", modal: true }] }));

    assert.deepEqual(verdict, { ok: false, code: "target_unsafe", rung: "committing_wording" }, word);
  }
});

function element(overrides: Partial<ResolvedWebLlmEvidenceElement>): ResolvedWebLlmEvidenceElement {
  return { target: "target.1", tag: "button", selector: "#control", ...overrides };
}

function page(overrides: Partial<WebLlmPageEvidence> = {}): WebLlmPageEvidence {
  return {
    schemaVersion: "web-llm-evidence.v2",
    trust: "untrusted-page-evidence",
    location: "https://example.test/page",
    elements: [],
    truncated: false,
    ...overrides
  };
}
