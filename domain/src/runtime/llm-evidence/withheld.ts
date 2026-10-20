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
// A card number is screened too, in any string, a field's `value` included, by
// Core's in-place helper `automationStudioWithoutCardNumbers` (t728, audit
// finding 9): a run of 13 to 19 digits that passes the Luhn check, is written as
// a card is and starts with a digit a card issuer's number starts with. Core's
// credential check now also reports a card run, so the in-place pass must come
// first: the run alone is replaced by the marker, and a paragraph that quotes a
// card keeps its other words instead of costing the whole string. Core's
// grouping and issuer rules are what keep an order number or a millisecond
// timestamp from being withheld.
//
// This is the second fence. The first is still the sensitivity rule
// (`../../sensitivity`), which drops a control whose signature says it holds a
// secret before any of its strings are read.
//
// The marker is this module's rather than `sensitivity/redaction.ts`'s: the one
// marker there says a comparison was withheld because an action ran on a
// secret-holding control, which is not what happened to a page string.

import { automationStudioWithoutCardNumbers, screenAutomationStudioLlmEvidence } from "fluxiq/automation-studio";
import { pageText } from "./untrusted-json";

/** What a published string says instead of itself when it is shaped like a credential. */
export const WEB_LLM_WITHHELD_TEXT = "(withheld: shaped like a secret)";

/** The string, or the marker when Core's credential check matches it; a card number in it is withheld in place. */
export function screenedText(value: string): string {
  const cardless = automationStudioWithoutCardNumbers(value, WEB_LLM_WITHHELD_TEXT);
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
