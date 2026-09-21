import { defineScenario } from "../../types.js";
import { crossborderMarketplaceManifest, MARKET_SEED } from "./manifest/index.js";
import { renderHomePage } from "./markup/index.js";
import { routeMarket } from "./route.js";
import { createMarketState, mutateMarketState, type MarketState } from "./state/index.js";
import { marketClasses } from "./styles/index.js";

/**
 * Farbazaar, a cross-border marketplace modelled on the kind of site people
 * buy electronics from across a border: a home page with a rate-limited
 * infinite feed; a search whose results arrive as skeletons, mix paid
 * placements into organic ones, repeat results across pages, open items in a
 * new tab and page only by number because Next is broken; a traffic check on
 * every third results page; product pages with option pickers built from
 * divs, a chat pill over the buy button, a store coupon in a shadow root that
 * fails its first claim, and a framed description; a checkout with a framed
 * payment picker and a honeypot; consent, welcome coupons and a notification
 * prompt arriving on their own schedules; and every class a per-seed build
 * hash and every id minted per page load.
 *
 * The seed reaches the class hashes, the ids and the order numbers, and
 * nothing a buyer reads: the catalogue, prices and answers are authored.
 */
export const crossborderMarketplaceScenario = defineScenario<MarketState>({
  id: "crossborder-marketplace",
  title: "Cross-border marketplace",
  startPath: "/scenarios/crossborder-marketplace/",
  seed: MARKET_SEED,
  manifest: crossborderMarketplaceManifest,
  createState: (seed) => createMarketState(seed),
  mutate: mutateMarketState,
  render: (state, context) => renderHomePage(state, context, marketClasses(state.seed, state.mode)),
  route: routeMarket,
});
