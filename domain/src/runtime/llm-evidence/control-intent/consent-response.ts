const OFFER = /\b(?:join|joins|subscribe|subscribes|subscription|sign up|signup|register|buy|buys|purchase|order|checkout|check out|pay|claim|claims|redeem|redeems|grab|deal|offer|discount|newsletter|trial|membership|add to (?:cart|basket|bag))\b/iu;
const CONSENT_RESPONSE = /^(?:(?:i )?(?:accept|allow|agree)(?: to)?(?: all)?(?: (?:cookies|all cookies|the cookies|and close|and continue))?|(?:accept|allow) (?:all )?cookies and (?:close|continue)|yes(?:,? i(?:'m| am) happy)?|confirm|continue)[.!]?$/iu;

/** Closed positive answers only: observed consent context cannot sanitize an offer. */
export function isConsentResponse(words: string): boolean {
  return !OFFER.test(words) && CONSENT_RESPONSE.test(words);
}
