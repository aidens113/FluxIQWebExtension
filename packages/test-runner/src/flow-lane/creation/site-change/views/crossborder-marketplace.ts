import { countOf, nested, part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The marketplace: its cart by listing and exact choice, orders, collected coupons, followed stores and the delivery region. */
export function crossborderMarketplaceView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  const line = (list: string, item: Readonly<Record<string, unknown>>) => {
    const choice = nested(item, "choice");
    return `${list}:${part(item, "listingId")}:${part(choice, "color")}/${part(choice, "spec")}/${part(choice, "origin")}`;
  };
  for (const item of recordsOf(state, "cart")) tally(view, line("cart", item), countOf(item, "quantity"));
  for (const order of recordsOf(state, "orders")) {
    tally(view, "orders");
    for (const item of recordsOf(order, "lines")) tally(view, line("ordered", item), countOf(item, "quantity"));
  }
  const coupons = nested(state, "coupons");
  for (const store of textsOf(coupons, "stores")) tally(view, `coupon:${store}`);
  if (coupons.platform === true) tally(view, "coupon:platform");
  if (state.welcome === "collected") tally(view, "coupon:welcome");
  for (const store of textsOf(state, "following")) tally(view, `following:${store}`);
  if (typeof state.region === "string") tally(view, `region:${state.region}`);
  if (state.notifications === "allowed") tally(view, "notifications");
  return view;
}
