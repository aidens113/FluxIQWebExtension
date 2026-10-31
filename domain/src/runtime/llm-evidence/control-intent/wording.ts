const WAY_OUT = /^(?:close|dismiss|minimi[sz]e|hide|not now|no,? thanks?|no thank you|maybe later|remind me later|later|skip|not interested|continue without|continue shopping|continue browsing|reject|decline|refuse|deny|cancel)(?:$|[\s,.!:;-])/iu;
const CLOSE_GLYPH = /^[×✕✖╳xX]$/u;
const ACCEPTING = /\b(?:accept|accepts|agree|agrees|allow|yes|confirm|confirms|join|joins|subscribe|subscribes|sign up|signup|register|buy|buys|purchase|order now|place order|checkout|check out|pay now|claim|claims|redeem|redeems|add to (?:cart|basket|bag))\b/iu;
const ACCEPTING_LEAD = /^(?:grab|get|claim|shop|start|try|add|buy|unlock|activate|enroll|enrol|continue)\b/iu;


export function wordingIntent(words: string): "accept" | "dismiss" | undefined {
  if (CLOSE_GLYPH.test(words)) return "dismiss";
  const wayOut = WAY_OUT.exec(words);
  if (wayOut) {
    // The legacy price refusal is a decline, even though it mentions paying.
    if (/^no,? thanks?,? i would rather pay full price[.!]?$/iu.test(words)) return "dismiss";
    const tail = words.slice(wayOut[0].length);
    // Negated acceptance is still a way out; a second positive act is not.
    const remaining = tail.replace(/^(?:accepting|acceptance|consenting|cookies)\b/iu, "");
    if (!ACCEPTING.test(remaining) && !/\b(?:and|then|also|to)\s+(?:grab|get|shop|start|try|add|unlock|activate|enroll|enrol)\b/iu.test(remaining)) return "dismiss";
    return "accept";
  }
  return ACCEPTING.test(words) || ACCEPTING_LEAD.test(words) ? "accept" : undefined;
}

