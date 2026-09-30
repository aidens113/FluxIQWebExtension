// The one secret screen every string of the packet passes before it is
// published (t200).
//
// The packet stopped cutting page text on 2026-09-30, so nothing now shortens a
// token out of an attribute, a link or a label on its way to the model. What
// stands in its place is Core's own credential check,
// `screenAutomationStudioLlmEvidence(text, []).secretShaped` -- the same check
// Core's pre-send screen applies to every request -- run here first, string by
// string. A string it matches is replaced by `WEB_LLM_WITHHELD_TEXT`, so one
// token-shaped attribute costs that attribute rather than Core refusing the
// whole page.
//
// Core's shapes are credentials, and a card number is not one of them. So a
// card number is screened here too, in any string, a field's `value` included:
// a run of 13 to 19 digits that passes the Luhn check, is written as a card is
// (unbroken, in fours, or Amex's and Diners' 4-6-5 and 4-6-4) and starts with a
// digit a payment card's issuer number starts with (2 to 6). The run alone is
// replaced by the marker, so a paragraph that quotes a card keeps its other
// words. The grouping and issuer rules are what keep an order number
// (`112-5550123-4567890`) or a millisecond timestamp (`1727712000000`), one in
// ten of which passes Luhn by chance, from being withheld.
//
// This is the second fence. The first is still the sensitivity rule
// (`../../sensitivity`), which drops a control whose signature says it holds a
// secret before any of its strings are read.
//
// The marker is this module's rather than `sensitivity/redaction.ts`'s: the one
// marker there says a comparison was withheld because an action ran on a
// secret-holding control, which is not what happened to a page string.

import { screenAutomationStudioLlmEvidence } from "fluxiq/automation-studio";
import { pageText } from "./untrusted-json";

/** What a published string says instead of itself when it is shaped like a credential. */
export const WEB_LLM_WITHHELD_TEXT = "(withheld: shaped like a secret)";

/**
 * A run of digits that may be a card number: 13 to 19 digits, a single space
 * or dash allowed between them, with no digit run continuing on either side.
 */
const DIGIT_RUN = /(?<!\d)(?<!\d[ -])\d(?:[ -]?\d){12,18}(?![ -]?\d)/gu;
/** Unbroken, or in groups of four with a shorter last group, or Amex's 4-6-5 and Diners' 4-6-4. */
const CARD_GROUPING = /^(?:\d{13,19}|\d{4}(?:[ -]\d{4}){2,3}(?:[ -]\d{1,4})?|\d{4}[ -]\d{6}[ -]\d{4,5})$/u;

/** The string, or the marker when Core's credential check matches it; a card number in it is withheld in place. */
export function screenedText(value: string): string {
  const cardless = value.replace(DIGIT_RUN, (run) => (cardNumber(run) ? WEB_LLM_WITHHELD_TEXT : run));
  return screenAutomationStudioLlmEvidence(cardless, []).secretShaped ? WEB_LLM_WITHHELD_TEXT : cardless;
}

/** A page string read as one line (`pageText`) and screened; `undefined` when there is none. */
export function screenedPageText(input: unknown): string | undefined {
  const text = pageText(input);
  return text === undefined ? undefined : screenedText(text);
}

/** Whether a published string is, or holds, the marker rather than only what the page said. */
export function isWithheldText(value: string | undefined): boolean {
  return value !== undefined && value.includes(WEB_LLM_WITHHELD_TEXT);
}

function cardNumber(run: string): boolean {
  if (!CARD_GROUPING.test(run)) return false;
  const digits = run.replace(/[ -]/gu, "");
  return digits.length >= 13 && digits.length <= 19 && /^[2-6]/u.test(digits) && luhn(digits);
}

/** The Luhn check every payment card number passes. */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
