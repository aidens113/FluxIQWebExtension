// A card number is withheld from every string the packet publishes (t200,
// `../withheld.ts`): Core's credential shapes do not match one, and the packet
// now carries a text field's value and every string whole.

import assert from "node:assert/strict";
import test from "node:test";
import { screenAutomationStudioLlmEvidence } from "fluxiq/automation-studio";
import { sanitizeWebLlmSnapshot } from "../sanitize";
import { isWithheldText, screenedText, WEB_LLM_WITHHELD_TEXT } from "../withheld";

const CARDS = [
  "4111111111111111",
  "4111 1111 1111 1111",
  "4111-1111-1111-1111",
  "5555555555554444",
  "6011111111111117",
  "378282246310005",
  "3782 822463 10005",
  // Mastercard's 2-series.
  "2223000048400011"
];

test("a Luhn-valid card number, unbroken or grouped as a card is, is withheld in place", () => {
  for (const card of CARDS) {
    assert.equal(screenedText(card), WEB_LLM_WITHHELD_TEXT, card);
    assert.equal(screenedText(`Card ${card} on file.`), `Card ${WEB_LLM_WITHHELD_TEXT} on file.`, card);
    assert.equal(isWithheldText(screenedText(`Card ${card} on file.`)), true, card);
  }
  // Two in one string are both withheld, and the words between them kept.
  assert.equal(screenedText("4111111111111111 or 5555555555554444"), `${WEB_LLM_WITHHELD_TEXT} or ${WEB_LLM_WITHHELD_TEXT}`);
});

test("digit runs that are not card numbers are left as the page wrote them", () => {
  const kept = [
    // Fails Luhn.
    "4111111111111112",
    // Luhn-valid, but a millisecond timestamp: no card issuer number starts with 1.
    "1727712000006",
    // Luhn-valid and starting with 4, but grouped as an order number is, not as a card.
    "412-5550123-4567884",
    // Too short, and too long.
    "411111111111",
    "41111111111111111111",
    "Call 555-123-4567",
    "SKU 4006381333931 in stock"
  ];
  for (const text of kept) assert.equal(screenedText(text), text, text);
});

test("a card number is withheld wherever the packet would publish it: a field's value, its text, an attribute and a link", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://shop.test/checkout",
    interactiveElements: [
      // An unmarked text field: the sensitivity rule does not drop it, so the screen is what withholds its value.
      { tagName: "input", selector: "#notes", accessibleName: "Order notes", value: "Use 4111 1111 1111 1111 please", hasValue: true },
      { tagName: "p", selector: "#saved", visibleText: "Saved card 5555-5555-5555-4444", attributes: { "data-card": "6011111111111117" } },
      { tagName: "a", selector: "#pay", visibleText: "Pay", href: "https://shop.test/pay?card=4111111111111111&step=2" }
    ]
  });
  const [notes, saved, pay] = evidence.elements;
  assert.equal(notes?.value, `Use ${WEB_LLM_WITHHELD_TEXT} please`);
  assert.equal(saved?.text, `Saved card ${WEB_LLM_WITHHELD_TEXT}`);
  assert.deepEqual(saved?.attributes, [["data-card", WEB_LLM_WITHHELD_TEXT]]);
  assert.equal(pay?.href, "https://shop.test/pay?card=(withheld)&step=2");
  const published = JSON.stringify(evidence);
  for (const digits of ["4111", "5555", "6011"]) assert.doesNotMatch(published, new RegExp(digits, "u"), digits);
  assert.equal(screenAutomationStudioLlmEvidence(evidence, []).secretShaped, false);
});
