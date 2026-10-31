import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { collectWebLlmControlIntents } from "..";

function classify(words: string, consent = false) {
  const binding = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/", interactiveElements: [
      { tagName: "div", selector: "#notice", role: "dialog" },
      { tagName: "button", selector: "#answer", accessibleName: words, parent: 0 }
    ],
    evidence: consent ? { dialogs: { open: [{ selector: "#notice", modal: false, kind: "consent" }] } } : {}
  });
  return collectWebLlmControlIntents(binding).get("t2");
}

test("ports the authoring acceptance vocabulary without label-only consent authority", () => {
  for (const words of ["Grab the offer", "Join now", "Subscribe", "Sign up for updates", "Buy now", "Confirm", "Continue", "Continue to checkout", "Get the app", "Grab it", "Yes, I want it", "Add to bag", "Accept the offer", "Accept and subscribe"]) {
    assert.deepEqual(classify(words), { intent: "accept" }, words);
  }
});

test("ports legitimate way outs, including the price refusal and negated acceptance", () => {
  for (const words of ["Close", "×", "✕", "X", "No thanks, I would rather pay full price", "Not now", "Maybe later", "Dismiss", "Reject non-essential", "Continue without accepting", "Skip", "Continue shopping", "Continue browsing", "Cancel", "No thank you"]) {
    assert.deepEqual(classify(words), { intent: "dismiss" }, words);
  }
});

test("truthful consent acceptance requires actual consent membership, with no reject-availability veto", () => {
  for (const words of ["Accept all", "Accept cookies", "Accept all cookies", "Allow all", "Agree", "I agree", "Accept", "Allow cookies and continue", "Yes, I'm happy"]) {
    assert.deepEqual(classify(words), { intent: "accept" }, words);
    assert.deepEqual(classify(words, true), { intent: "accept", responseOnly: true }, words);
  }
});

test("a consent layer never launders an offer or conjunction into a response or dismissal", () => {
  for (const words of ["Accept and subscribe", "Subscribe to our newsletter", "Accept cookies and buy now", "Close and subscribe", "No thanks and sign up", "Continue shopping and buy now", "Reject cookies and start trial", "Accept cookies and start a free trial", "Continue to checkout"]) {
    assert.deepEqual(classify(words, true), { intent: "accept" }, words);
  }
});

test("unbounded, non-English and ambiguous wording supplies no semantic proof", () => {
  for (const words of ["Join now " + "words ".repeat(20), "Tout accepter", "Proceed", "OK"]) {
    assert.deepEqual(classify(words, true), { intent: "neutral" }, words);
  }
  assert.deepEqual(classify("Accept " + "a".repeat(73)), { intent: "accept" });
  assert.deepEqual(classify("Accept " + "a".repeat(74)), { intent: "neutral" });
});
