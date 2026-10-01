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
import {
  DISMISS_LABEL_MAX,
  isConsentDeclineLabel,
  isConsentLayerText,
  isDismissalLabel,
  isRateLimitAcknowledgeLabel,
  isRateLimitLayerText,
  isTransientRefusalText
} from "../vocabulary";

// What a page writes beside a press it was too busy to carry out
// (`../../rate-limit-notice.ts`): crossborder's store coupon and checkout.
const BUSY_REFUSALS = [
  "Store coupon €3 off orders over €20 Get coupons Network busy, please try again",
  "Network busy, please try again",
  "Server busy. Please retry.",
  "The service is temporarily unavailable.",
  "System overloaded",
  "We're too busy right now",
  "Busy, try again"
];

// Never a busy refusal: a press is repeated on the page's word only when that
// word says the press never went through.
const NOT_BUSY_REFUSALS = [
  "Your payment could not be processed. Try again.",
  "Something went wrong. We could not save this item. Try again",
  "Temporarily unavailable",
  "Currently unavailable. We don't know when or if this item will be back in stock.",
  "Your address book is being updated. Please try again later.",
  "Business hours: 9-5",
  "Get coupons"
];

test("a page saying it was too busy to carry the press out is a busy refusal", () => {
  for (const text of BUSY_REFUSALS) assert.equal(isTransientRefusalText(text), true, text);
});

test("a failure, an item out of stock, or a bare try again is not a busy refusal", () => {
  for (const text of NOT_BUSY_REFUSALS) assert.equal(isTransientRefusalText(text), false, text);
});

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
  "Not now, thanks.",
  // The support chats' only way out: crossborder's pill glyph (title) and the
  // everything store's chat (aria-label) over the buy box (t174-w32, t174-w34).
  "Minimize chat",
  "Minimise",
  "Minimize"
];

const NEVER = [
  // A minimise that would act on something is refused like any other dismissal.
  "Minimize and delete chat",
  "Minimise and cancel my subscription",
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
  // Answering a cookie banner is not a general dismissal in either direction.
  // Declining is a way out of a consent layer only (the battery below).
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

// The consent layer's way out (lane t195, run `run-munoa86g-150fb0d9`). Declining
// optional cookies gives nothing away; accepting shares the person's data. The
// first battery is every decline the ten realistic scenarios draw, the second is
// every answer that accepts, manages or hides a consequence.
const CONSENT_DECLINES = [
  "Reject all",
  "Reject all cookies",
  "Reject",
  "Reject optional cookies",
  "Decline optional cookies",
  "Decline all",
  "Refuse all",
  "Deny",
  "Necessary cookies only",
  "Use necessary cookies only",
  "Essential only",
  "Only allow essential cookies",
  "Only necessary",
  "Continue without accepting"
];

const CONSENT_NEVER = [
  "Accept all",
  "Accept all cookies",
  "Accept",
  "Allow all cookies",
  "Allow all",
  "Agree and continue",
  "I agree",
  "Manage choices",
  "Manage preferences",
  "Save preferences",
  "Reject all or accept",
  "Reject and delete my account",
  "Decline and cancel my subscription",
  "Rejected items",
  "Declined payments"
];

test("every consent decline the scenarios draw may be pressed on a consent layer", () => {
  for (const label of CONSENT_DECLINES) {
    assert.equal(isConsentDeclineLabel(label), true, `${label} would not be pressed, so the consent wall would stop the Flow`);
  }
});

test("nothing that accepts cookies, or deletes, cancels or pays, is a consent decline", () => {
  for (const label of CONSENT_NEVER) {
    assert.equal(isConsentDeclineLabel(label), false, `${label} would be pressed on the person's behalf`);
  }
});

test("a consent decline is not a general dismissal: on any other dialog Reject and Decline stay unpressed", () => {
  for (const label of ["Reject all", "Decline optional cookies", "Decline"]) {
    assert.equal(isDismissalLabel(label), false, label);
  }
});

// The rate-limit notice's way out (lane t195, social-network-feed's fourth
// Confirm). Its OK closes it and confirms nothing; its "Try again" does the
// refused act, which only the node's own re-run may do.
const RATE_LIMIT_NOTICES = [
  "You're going too fast It looks like you were misusing this feature by going too fast. You've been temporarily blocked from using it. You can try again in 12 seconds. OK",
  "You're going too fast It looks like you were misusing this feature by going too fast. You've been temporarily blocked from using it. You can try again in 0 seconds. OK Try again",
  "Slow down! Please wait 30 seconds before posting again.",
  "Too many attempts. Try again in 2 minutes.",
  "You're doing that too quickly.",
  "Rate limited: retry later."
];

const NOT_RATE_LIMIT_NOTICES = [
  "Priya Nair invited you to the Riverside Allotment Society. OK",
  "Your payment could not be processed. Try again.",
  "Delete this post? This cannot be undone. OK Cancel",
  "Your privacy choices ValueRidge and our 38 partners use cookies",
  "Saved. You can try again later if the list looks out of date."
];

test("the scenarios' going-too-fast notice, and every phrase of the closed list, reads as a rate-limit layer", () => {
  for (const text of RATE_LIMIT_NOTICES) assert.equal(isRateLimitLayerText(text), true, text);
});

test("a dialog that is not about going too fast is not a rate-limit layer, however it ends", () => {
  for (const text of NOT_RATE_LIMIT_NOTICES) assert.equal(isRateLimitLayerText(text), false, text);
});

test("OK acknowledges a rate-limit notice, and nothing longer or consequential does", () => {
  for (const label of ["OK", "Ok", "Okay", "OK.", "Got it", "Got it!", "Understood", "I understand"]) {
    assert.equal(isRateLimitAcknowledgeLabel(label), true, label);
  }
  for (const label of ["Try again", "Retry", "OK, delete it", "OK to charge my card", "Okay, confirm", "Confirm", "Continue", "", "OK".padEnd(DISMISS_LABEL_MAX + 1, "!")]) {
    assert.equal(isRateLimitAcknowledgeLabel(label), false, label);
  }
});

test("OK is not a general dismissal: on any other dialog it stays unpressed", () => {
  for (const label of ["OK", "Okay", "Got it", "Try again"]) {
    assert.equal(isDismissalLabel(label), false, label);
    assert.equal(isConsentDeclineLabel(label), false, label);
  }
});

test("only a layer that is about cookies or consent is read for a decline", () => {
  assert.equal(isConsentLayerText("Your privacy choices ValueRidge and our 38 partners use cookies"), true);
  assert.equal(isConsentLayerText("Allow the use of cookies from Circleway on this browser?"), true);
  assert.equal(isConsentLayerText("Priya Nair invited you to the Riverside Allotment Society. Accept Decline"), false);
  assert.equal(isConsentLayerText("You're going too fast. You can try again in 9 seconds."), false);
});
