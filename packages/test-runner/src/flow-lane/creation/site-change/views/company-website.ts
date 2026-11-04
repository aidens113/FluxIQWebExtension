import { countOf, nested, part, recordsOf, tally, textsOf, type LastingView, type SiteState } from "../lasting-view.js";

/** The company site: quote requests by service, bookings by branch and service, deposits paid and newsletter subscribers. */
export function companyWebsiteView(state: SiteState): LastingView {
  const view: Record<string, number> = {};
  for (const quote of recordsOf(state, "quotes")) tally(view, `quote:${part(quote, "service")}`);
  for (const booking of recordsOf(state, "bookings")) tally(view, `booking:${part(booking, "branchId")}:${part(booking, "serviceId")}`);
  tally(view, "deposits", countOf(nested(state, "deposits"), "count"));
  tally(view, "newsletter", textsOf(nested(state, "newsletter"), "subscribers").length);
  return view;
}
