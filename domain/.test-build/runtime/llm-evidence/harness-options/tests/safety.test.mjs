// domain/src/runtime/llm-evidence/harness-options/tests/safety.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// domain/src/runtime/llm-evidence/harness-options/safety.ts
var WEB_RECOVERY_COMMITTING_WORDS = /\b(?:submit|save|apply|approve|confirm|purchase|buy|pay|checkout|order|transfer|withdraw|delete|remove|destroy|erase|discard|reset|revoke|unsubscribe|send|publish|post|upload|sign|accept)\b/iu;
var WEB_RECOVERY_DISMISSAL_WORDS = /\b(?:close|dismiss|cancel|back|later|skip|no thanks|not now|got it|understood|continue browsing)\b/iu;
var ACTIONABLE_ROLES = /* @__PURE__ */ new Set(["button", "tab", "menuitem", "treeitem"]);
var ACTIONABLE_TAGS = /* @__PURE__ */ new Set(["button", "summary"]);
function webRecoverySafeActionVerdict(element2, page2) {
  const identity = [element2.name, element2.text, element2.selector].filter(Boolean).join(" ");
  if (WEB_RECOVERY_COMMITTING_WORDS.test(identity)) return { ok: false, code: "target_unsafe", rung: "committing_wording" };
  if (element2.controlType === "submit" || element2.inputType === "submit" || element2.role === "submit") {
    return { ok: false, code: "target_unsafe", rung: "submit_control" };
  }
  if (element2.form !== void 0 || element2.tag === "form") return { ok: false, code: "target_unsafe", rung: "form_owned" };
  if (!isActionableControl(element2)) return { ok: false, code: "target_unsafe", rung: "not_an_actionable_control" };
  const identified = Boolean(element2.name) || Boolean(element2.text);
  const signals = agreeingSignals(element2, page2);
  if (signals.length < (identified ? 1 : 2)) return { ok: false, code: "target_unsafe", rung: "unidentified_without_corroboration" };
  return { ok: true, identified, signals };
}
function isActionableControl(element2) {
  if (ACTIONABLE_TAGS.has(element2.tag)) return true;
  if (element2.role !== void 0 && ACTIONABLE_ROLES.has(element2.role)) return true;
  return element2.tag === "input" && (element2.controlType === "button" || element2.inputType === "button");
}
function agreeingSignals(element2, page2) {
  const signals = [];
  const wording = [element2.name, element2.text].filter(Boolean).join(" ");
  if (wording && WEB_RECOVERY_DISMISSAL_WORDS.test(wording)) signals.push("dismissal_wording");
  if (page2.dialogs?.some((dialog) => dialog.modal === true) || page2.blockedBy !== void 0) signals.push("modal_dialog");
  if (element2.landmark === "dialog" || element2.landmark === "alertdialog") signals.push("dialog_landmark");
  if (element2.revealKind === "disclosure") signals.push("reversible_disclosure");
  if (element2.revealKind === "view" && element2.role !== void 0 && ACTIONABLE_ROLES.has(element2.role) && element2.role !== "button") signals.push("view_switch");
  return signals;
}

// domain/src/runtime/llm-evidence/harness-options/tests/safety.test.ts
var REFUSALS = [
  ["a button whose name says it deletes", { name: "Delete account", role: "button" }, "committing_wording"],
  ["a button whose visible text says it pays", { text: "Pay now", role: "button" }, "committing_wording"],
  ["a button whose selector says it submits", { selector: "#submit-order", name: "Continue", role: "button" }, "committing_wording"],
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
test("lets an unlabelled control through only when two independent things agree", () => {
  const unlabelled = element({ tag: "button", landmark: "dialog" });
  const alone = webRecoverySafeActionVerdict(unlabelled, page());
  const corroborated = webRecoverySafeActionVerdict(unlabelled, page({ blockedBy: { role: "dialog", blocks: 12 } }));
  assert.equal(alone.ok, false);
  assert.deepEqual(corroborated, { ok: true, identified: false, signals: ["modal_dialog", "dialog_landmark"] });
});
test("refuses a delete that took the place of the recorded control, however alike they look", () => {
  const recorded = { tag: "button", role: "button", name: "Details", landmark: "dialog", selector: "#row-3 > button" };
  const replacement = { ...recorded, name: "Delete" };
  const context = page({ dialogs: [{ role: "dialog", modal: true }] });
  assert.equal(webRecoverySafeActionVerdict(element(recorded), context).ok, true);
  assert.deepEqual(webRecoverySafeActionVerdict(element(replacement), context), { ok: false, code: "target_unsafe", rung: "committing_wording" });
});
test("every committing word is refused on the same rung, so none of them depends on where it appears", () => {
  for (const word of ["Submit", "Save", "Apply", "Confirm", "Purchase", "Checkout", "Transfer", "Delete", "Remove", "Reset", "Unsubscribe", "Send", "Publish", "Upload", "Accept"]) {
    const verdict = webRecoverySafeActionVerdict(element({ tag: "button", name: `${word} it`, landmark: "dialog" }), page({ dialogs: [{ role: "dialog", modal: true }] }));
    assert.deepEqual(verdict, { ok: false, code: "target_unsafe", rung: "committing_wording" }, word);
  }
});
function element(overrides) {
  return { target: "target.1", tag: "button", selector: "#control", ...overrides };
}
function page(overrides = {}) {
  return {
    schemaVersion: "web-llm-evidence.v2",
    trust: "untrusted-page-evidence",
    location: "https://example.test/page",
    elements: [],
    truncated: false,
    ...overrides
  };
}
