// Which words name a payment card's security code. The rule reads a control's
// author identifiers (`name`, `id`) and the words that label it, because a real
// card form often leaves `autocomplete="cc-csc"` off: bigbox-retail's card
// frame carries `<input name="cvc">` under the label "Security code" and no
// `autocomplete`, and a headed probe (t730 c2) found what was typed into it in
// the snapshot, every recorded keydown and the recorded `dom.input`.
//
// The negative rows weigh as much as the positive ones: a word list that
// matched every "code" field would withhold a promo code and a ZIP code, which
// the recorder is supposed to capture.

import assert from "node:assert/strict";
import test from "node:test";
import { namesCardSecurityCode } from "../card-security-code";

test("the short names of a card security code, however an author spells the identifier", () => {
  for (const words of ["cvc", "CVC", "cvv", "csc", "cvn", "cvc2", "cvv2", "cardCvc", "cardCVV", "cc_cvv2", "cc-csc", "payment[cvc]", "cvv-2", "card.cvn"]) {
    assert.equal(namesCardSecurityCode(words), true, words);
  }
});

test("the spelled-out names, as identifiers and as label words", () => {
  for (const words of [
    "securityCode",
    "card-security-code",
    "security_code",
    "securitycode",
    "Security code",
    "Card security code",
    "CVC / CVV",
    "3-digit code on the back (CVV)",
    "Card verification value",
    "Card validation code",
  ]) {
    assert.equal(namesCardSecurityCode(words), true, words);
  }
});

test("other codes and near words are not a card security code", () => {
  for (const words of [
    "",
    "code",
    "Promo code",
    "Gift card code",
    "ZIP code",
    "postal_code",
    "discountCode",
    "Security question",
    "security",
    "Card number",
    "cardholder",
    "cvcx",
    "recvc",
    "Verification code sent by email",
  ]) {
    assert.equal(namesCardSecurityCode(words), false, words);
  }
});
