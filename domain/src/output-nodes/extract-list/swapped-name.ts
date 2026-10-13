// Whether a name's nearest column is the column it means, or the one beside it
// (t497).
//
// `./column-match.ts` resolves a name written slightly wrong to its nearest
// column rather than refusing it, because a refusal for a spelling costs a paid
// call the model does not act on. That rule is right for a *spelling* and wrong
// for a *different column*, and Core's similarity score cannot tell them apart:
// two keys of one detection share the path of the card they sit in, so a key
// from another detection scores high against whichever column of this one
// shares most of that path.
//
// Lane D round 15 (`run-mv6ep5oy-05d5095c`, D1) is the case. Revision 5's
// condition named `div_x0531l50_x1r2vv8_x4q0id2_div_x1papwzz_xu37y6r_xvzo2ll`,
// the "Request accepted" text of a later detection, on a read of an earlier one
// that has no such column. Its nearest column was the Confirm button
// (`..._div_x1507i5_x1mgzeci_xu37y6r`): five tokens shared, two different on
// each side. The condition tested the button, kept the four pending rows, and
// nothing told the model; three more trials went on a column it never meant.
//
// ## The rule: a part swapped for another part is a different column
//
// Both names are folded by Core (`normalizeAutomationStudioName`) and split into
// tokens, and each token of one is paired with at most one of the other, best
// pair first, by Core's own token credit (`automationStudioNameTokenCredit`: the
// same token, a near one, or a synonym). Then the guess **swaps a part** when:
//
// - the two names share at least one token -- they are of one family -- and
// - the written name keeps a token nothing in the column answers to, and
// - the column keeps a token nothing written answers to.
//
// That is a name with a part *replaced*: the same family, a different member.
// It is refused, so the model is told the read's columns and picks one.
//
// What it leaves alone is every shape the standing rule exists for:
//
// - **a name written short** (`rating` for `product-rating`, `image` for
//   `product-image_alt`): every written token is answered, so nothing was
//   replaced, only left out;
// - **a name written long** (`product-ratings-value` for `rating`): the column's
//   tokens are all answered;
// - **a token misspelled** (`ratng`, `prise`): Core's token credit pairs them;
// - **a whole name mistyped** (`product-lnk`, where a three-letter token earns
//   no credit): two names within Core's typo distance of each other are a slip
//   and never a swap, by the same bound Core uses (`similarity.ts`,
//   `withinTypoDistance`: one edit up to four characters, two from five);
// - **a name sharing nothing** with its column (`price` for a key labelled
//   `currency_amount`): no family, so no member was swapped, and the name is a
//   guess on the whole as before.
//
// The rule reads names only, never a value: a detection carries none (D3).

import {
  automationStudioNameEditDistance,
  automationStudioNameTokenCredit,
  normalizeAutomationStudioName
} from "fluxiq/automation-studio/nodes";

/**
 * Whether `column` is `written` with a part swapped for another (header):
 * a token shared, and a token on each side the other does not answer.
 */
export function webExtractionNameSwapsPart(written: string, column: string): boolean {
  const left = normalizeAutomationStudioName(written);
  const right = normalizeAutomationStudioName(column);
  if (left.length === 0 || right.length === 0 || left === right) return false;
  if (withinTypoDistance(left, right)) return false;
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const paired = pairing(leftTokens, rightTokens);
  if (paired.left.size === 0) return false;
  return paired.left.size < leftTokens.length && paired.right.size < rightTokens.length;
}

/** Core's whole-name typo bound (`similarity.ts`): one edit up to four characters, two from five, on the longer name. */
function withinTypoDistance(left: string, right: string): boolean {
  const longest = Math.max(left.length, right.length);
  return automationStudioNameEditDistance(left, right) <= (longest <= 4 ? 1 : 2);
}

function tokens(name: string): string[] {
  return [...new Set(name.split(" ").filter((token) => token.length > 0))];
}

/** A best-first, one-to-one pairing of the two token lists by Core's token credit, as Core's own overlap pairs them (`token-overlap.ts`). */
function pairing(leftTokens: readonly string[], rightTokens: readonly string[]): { left: Set<number>; right: Set<number> } {
  const pairs: { left: number; right: number; credit: number }[] = [];
  for (const [left, leftToken] of leftTokens.entries()) {
    for (const [right, rightToken] of rightTokens.entries()) {
      const credit = automationStudioNameTokenCredit(leftToken, rightToken);
      if (credit > 0) pairs.push({ left, right, credit });
    }
  }
  pairs.sort((first, second) => second.credit - first.credit || first.left - second.left || first.right - second.right);
  const claimed = { left: new Set<number>(), right: new Set<number>() };
  for (const pair of pairs) {
    if (claimed.left.has(pair.left) || claimed.right.has(pair.right)) continue;
    claimed.left.add(pair.left);
    claimed.right.add(pair.right);
  }
  return claimed;
}
