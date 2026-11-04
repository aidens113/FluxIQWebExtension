import { part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The auction site: its watchlist, saved sellers, bids by item and purchases. */
export function auctionMarketplaceView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const id of textsOf(state, "watched")) tally(view, `watched:${id}`);
  for (const id of textsOf(state, "followed")) tally(view, `followed:${id}`);
  for (const bid of recordsOf(state, "bids")) tally(view, `bid:${part(bid, "itemId")}`);
  for (const id of textsOf(state, "purchases")) tally(view, `purchase:${id}`);
  return view;
}
