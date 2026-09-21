import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { BRANCHES } from "./data/index.js";
import {
  BOOKING_WIDGET_PATH, bookingWidget, priceListFragment, renderBook, renderBookingConfirmed, renderBranches, renderDirections,
  renderQuoteReceived, renderServices, renderTeam, teamBatch,
} from "./pages/index.js";
import { siteClasses } from "./styles.js";
import type { CompanyWebsiteState } from "./types.js";

/**
 * Every page under the start page. The site's pages, the two fragments its
 * scripts fetch (a team batch, a price list), the booking widget's document,
 * and the two confirmations, which are rendered from what the server holds.
 * `now` is only for the team endpoint's rate limit.
 */
export function routeCompanyWebsite(state: CompanyWebsiteState, request: ScenarioRouteRequest, context: RenderContext, now: number = Date.now()): ScenarioRouteResponse | undefined {
  const page = (body: string): ScenarioRouteResponse => ({ status: 200, body });
  switch (request.subpath) {
    case "team": return page(renderTeam(state, context));
    case "team/people": return teamBatch(state, request.query, context, now);
    case "services": return page(renderServices(state, context));
    case "services/prices": {
      const basis = request.query.get("basis") === "ex" ? "ex" : "inc";
      return page(priceListFragment(siteClasses(context.seed), basis));
    }
    case "branches": return page(renderBranches(state, context));
    case "directions": {
      const branchId = request.query.get("branch") ?? "";
      if (!BRANCHES.some(({ id }) => id === branchId)) return undefined;
      return { status: 200, body: renderDirections(state, context, branchId), mutation: { operation: "open-directions", payload: { branchId } } };
    }
    case "book": return page(renderBook(state, context));
    case BOOKING_WIDGET_PATH: return bookingWidget(state, context);
    case "booking/confirmed": return page(renderBookingConfirmed(state, context, request.query.get("ref")));
    case "quote/received": return page(renderQuoteReceived(state, context, request.query.get("ref")));
    default: return undefined;
  }
}
