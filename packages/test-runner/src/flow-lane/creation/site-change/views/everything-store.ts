import { countOf, part, recordsOf, tally, type LastingView, type SiteState } from "../lasting-view.js";

/** The store: its cart and saved lists by product and seller, orders, a started Plus trial and the newsletter. */
export function everythingStoreView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  const line = (list: string, item: Readonly<Record<string, unknown>>) => `${list}:${part(item, "sku")}:${typeof item.offerId === "string" ? item.offerId : "own"}`;
  for (const item of recordsOf(state, "cart")) tally(view, line("cart", item), countOf(item, "quantity"));
  for (const item of recordsOf(state, "saved")) tally(view, line("saved", item), countOf(item, "quantity"));
  for (const order of recordsOf(state, "orders")) {
    tally(view, "orders");
    for (const item of recordsOf(order, "lines")) tally(view, line("ordered", item), countOf(item, "quantity"));
    if (order.plusTrial === true) tally(view, "plus-trial");
  }
  if (state.newsletter === "subscribed") tally(view, "newsletter");
  return view;
}
