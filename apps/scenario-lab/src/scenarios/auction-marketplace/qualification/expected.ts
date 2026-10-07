import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { flyoutTexts } from "../pages/index.js";
import { createAuctionState } from "../state.js";

/** The lens is removed; the previously watched camera and all other account lists stay intact. */
export const accessoryCleanupExpected: ScenarioExpected = {
  pageFacts: [{ id: "cleanup-original-watchlist", subject: "watch-flyout", predicate: "text", value: flyoutTexts(createAuctionState()).watch }],
  extracted: [{ step: "extract-accessory-cleanup", count: 1, records: [{ title: "Kestrel 35 Rangefinder Camera", price: "£41.00" }] }],
  finalState: [
    { id: "cleanup-watchlist", subject: "watch-flyout", predicate: "text", value: "Kestrel 35 Rangefinder Camera · £41.00" },
    { id: "cleanup-no-bids", subject: "bids-flyout", predicate: "text", value: "" },
    { id: "cleanup-no-purchases", subject: "purchases-flyout", predicate: "text", value: "" },
    { id: "cleanup-no-sellers", subject: "followed-sellers", predicate: "text", value: "" },
  ],
};
