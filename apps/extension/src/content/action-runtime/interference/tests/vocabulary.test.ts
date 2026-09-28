// The guard that lets a runtime press a control nobody authored.
//
// The defence in this directory presses a dialog's own way out on the page's
// own initiative -- no Flow wrote that step and no model asked for it. What
// makes that acceptable is that the label it matches cannot be a destructive
// act, and this file is where that claim is held rather than asserted in prose.
//
// Two batteries. The first is what must be pressed, and it is not decoration:
// the everything-store `deal-wheel` fixture declines with "No thanks, I would
// rather pay full price", a dismissal whose tail contains a payment word, and a
// guard written as a substring scan would refuse the one control on that dialog
// that closes it. The second is what must never be pressed, and it is the
// product rule in a list: delete, purchase and payment are the person's, and a
// runtime clearing a popup must not be able to reach one by accident.

import assert from "node:assert/strict";
import test from "node:test";
import { DISMISS_LABEL_MAX, isDismissalLabel } from "../vocabulary";

const DISMISSALS = [
  "Close",
  "close",
  "Dismiss",
  "Hide",
  "×",
  "✕",
  "X",
  "Not now",
  "No thanks",
  "No, thanks",
  "No thank you",
  "Maybe later",
  "Remind me later",
  "Later",
  "Skip",
  "Not interested",
  "Continue without signing in",
  // The deal-wheel's own decline, which the fixture exists to produce.
  "No thanks, I would rather pay full price",
  "Not now, thanks."
];

const NEVER = [
  // Plainly consequential, and refused by the anchored allow-list alone.
  "Delete",
  "Delete account",
  "Remove item",
  "Buy now",
  "Buy it now",
  "Place your order",
  "Proceed to checkout",
  "Pay now",
  "Confirm purchase",
  "Confirm and pay",
  "Submit order",
  "Publish",
  "Send",
  "Share",
  "Unsubscribe",
  "Yes, delete it",
  // Answering a cookie banner is a choice about the person's data, not a way
  // out, so it is deliberately not a dismissal in either direction.
  "Accept all",
  "Accept all cookies",
  "Reject all",
  "Manage preferences",
  "Agree and continue",
  // The overlap the deny-list is for: a dismissal phrase that begins a
  // consequential sentence.
  "Close account",
  "Close my account",
  "Skip and delete my draft",
  "Not now, cancel my subscription",
  "Dismiss and unsubscribe",
  "Later, remove my card",
  "No thanks, deactivate my membership",
  // Prose that happens to start with a dismissal word.
  "Close this window to keep shopping, or carry on browsing our full range of offers"
];

test("every way out a real promotion offers is one this runtime may press", () => {
  for (const label of DISMISSALS) {
    assert.equal(isDismissalLabel(label), true, `${label} would not be pressed, so the dialog would never close`);
  }
});

test("nothing that deletes, buys or pays can be reached by a dismissal, however it is worded", () => {
  for (const label of NEVER) {
    assert.equal(isDismissalLabel(label), false, `${label} would be pressed by the runtime on its own initiative`);
  }
});

test("the allow-list is anchored, so a consequential verb cannot be reached by appending a dismissal to it", () => {
  for (const label of ["Delete, or close", "Buy now or not now", "Order now -- skip"]) {
    assert.equal(isDismissalLabel(label), false, label);
  }
});

test("an empty or oversized label is not a control's label", () => {
  assert.equal(isDismissalLabel(""), false);
  assert.equal(isDismissalLabel(`Close ${"x".repeat(DISMISS_LABEL_MAX)}`), false);
  assert.equal(isDismissalLabel("Close".padEnd(DISMISS_LABEL_MAX, "!")), true, "a label exactly at the bound is still a label");
});

test("a dismissal word inside a longer word is not a dismissal", () => {
  for (const label of ["Closeout deals", "Skipper", "Laterally"]) {
    assert.equal(isDismissalLabel(label), false, label);
  }
});
