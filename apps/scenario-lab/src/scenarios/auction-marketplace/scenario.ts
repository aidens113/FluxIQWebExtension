import { defineScenario } from "../../types.js";
import { auctionMarketplaceManifest } from "./manifest.js";
import { renderHome } from "./pages/index.js";
import { MARKET_ROOT } from "./paths.js";
import { routeAuctionMarketplace } from "./route.js";
import { createAuctionState, mutateAuctionState } from "./state.js";
import type { AuctionState } from "./types.js";

/**
 * Hammerline, an online auction marketplace modelled on the big ones, with
 * the film-camera corner of its catalogue: a home page, keyword search with
 * filters, sorting and pages, listing pages with bidding, Buy it now, a
 * watchlist, sellers' shops, bid histories and a bot check. What makes it hard
 * is described on the manifest.
 *
 * The listings, prices and times are authored and measured from the site's
 * own fixed clock, so every run reads the same page; the lab seed changes
 * only the generated class names and ids, which is what a new build does.
 */
export const auctionMarketplaceScenario = defineScenario<AuctionState>({
  id: "auction-marketplace",
  title: "Auction marketplace",
  startPath: MARKET_ROOT,
  seed: 4040,
  manifest: auctionMarketplaceManifest,
  createState: () => createAuctionState(),
  mutate: mutateAuctionState,
  render: renderHome,
  route: routeAuctionMarketplace,
});
