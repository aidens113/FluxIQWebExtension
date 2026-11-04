import { countOf, part, recordsOf, tally, type LastingView, type SiteState } from "../lasting-view.js";

/** The retailer: its cart and saved lists by product and fulfilment, orders, the chosen store, a promotion signed up to and anything it flagged. */
export function bigboxRetailView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  const line = (list: string, item: Readonly<Record<string, unknown>>) => `${list}:${part(item, "sku")}:${part(item, "fulfilment")}`;
  for (const item of recordsOf(state, "cart")) tally(view, line("cart", item), countOf(item, "qty"));
  for (const item of recordsOf(state, "saved")) tally(view, line("saved", item), countOf(item, "qty"));
  for (const order of recordsOf(state, "orders")) {
    tally(view, "orders");
    for (const item of recordsOf(order, "lines")) tally(view, line("ordered", item), countOf(item, "qty"));
  }
  if (typeof state.storeId === "string") tally(view, `store:${state.storeId}`);
  if (state.promo === "signed-up") tally(view, "promo");
  tally(view, "flagged-orders", countOf(state, "flaggedOrders"));
  tally(view, "flagged-signups", countOf(state, "flaggedSignups"));
  return view;
}
