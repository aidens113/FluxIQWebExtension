import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { flyoutTexts } from "../pages/index.js";
import type { AuctionState } from "../types.js";

/**
 * The account's four lists as the header's flyouts spell them in `state`: the
 * watchlist, bids, purchases and saved sellers. A run that watched, bid,
 * bought or saved anything it was not asked to leaves a different string in
 * one of them.
 */
export function accountFacts(state: AuctionState, prefix: string): ExpectedFact[] {
  const texts = flyoutTexts(state);
  return [
    { id: `${prefix}-watchlist`, subject: "watch-flyout", predicate: "text", value: texts.watch },
    { id: `${prefix}-bids`, subject: "bids-flyout", predicate: "text", value: texts.bids },
    { id: `${prefix}-purchases`, subject: "purchases-flyout", predicate: "text", value: texts.purchases },
    { id: `${prefix}-saved-sellers`, subject: "followed-sellers", predicate: "text", value: texts.followed },
  ];
}
