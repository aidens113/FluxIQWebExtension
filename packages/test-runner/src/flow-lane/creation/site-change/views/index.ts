// One lasting view per realistic site, by scenario id.
import type { RealisticScenarioId } from "../../../../realistic-scenarios/index.js";
import type { LastingView, SiteState } from "../lasting-view.js";
import { auctionMarketplaceView } from "./auction-marketplace.js";
import { bigboxRetailView } from "./bigbox-retail.js";
import { companyWebsiteView } from "./company-website.js";
import { crossborderMarketplaceView } from "./crossborder-marketplace.js";
import { everythingStoreView } from "./everything-store.js";
import { jobBoardView } from "./job-board.js";
import { localClassifiedsView } from "./local-classifieds.js";
import { photoSocialView } from "./photo-social.js";
import { professionalNetworkView } from "./professional-network.js";
import { socialNetworkFeedView } from "./social-network-feed.js";

/** Each realistic site's reading of its own state. */
export const SITE_LASTING_VIEWS: Readonly<Record<RealisticScenarioId, (state: SiteState) => LastingView>> = Object.freeze({
  "everything-store": everythingStoreView,
  "crossborder-marketplace": crossborderMarketplaceView,
  "bigbox-retail": bigboxRetailView,
  "job-board": jobBoardView,
  "local-classifieds": localClassifiedsView,
  "auction-marketplace": auctionMarketplaceView,
  "photo-social": photoSocialView,
  "social-network-feed": socialNetworkFeedView,
  "company-website": companyWebsiteView,
  "professional-network": professionalNetworkView,
});
