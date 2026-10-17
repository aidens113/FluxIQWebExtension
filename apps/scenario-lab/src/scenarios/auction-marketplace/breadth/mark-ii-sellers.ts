import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingByHandle } from "../catalog/index.js";
import { itemPath } from "../paths.js";
import { applyAuctionMutation, createAuctionState } from "../state.js";
import type { AuctionState, Listing } from "../types.js";
import { accountFacts } from "./account-facts.js";
import { arrivalSteps } from "./arrival.js";

const FRESH = createAuctionState();

/**
 * The four Kestrel 35 Mk II auctions, however their sellers wrote the model
 * (Mk II, MkII, Mark 2), whose sellers "save every seller with a Mark II up
 * for auction" saves. None of them sells the 35S or the original on its own.
 */
const MARK_II_AUCTIONS: readonly Listing[] = ["l4", "l5", "l6", "l10"].map((handle) => listingByHandle(handle));
const SAVED = MARK_II_AUCTIONS.reduce((state: AuctionState, listing) => applyAuctionMutation(state, "follow-seller", { seller: listing.seller }, 0), FRESH);

/** The Saved sellers list after the four saves, in the order the account lists them, which is alphabetical. */
const records = [...SAVED.followed].sort((left, right) => left.localeCompare(right, "en")).map((seller) => ({ seller }));

const saveSteps = (listing: Listing, ordinal: string): ScenarioStep[] => [
  { id: `sellers-open-${ordinal}`, operation: "navigate", path: itemPath(listing.id) },
  { id: `sellers-save-${ordinal}`, operation: "click", target: "role:button:Save seller" },
  { id: `sellers-${ordinal}-saved`, operation: "waitForState", target: `button[aria-pressed="true"]:text-is("Seller saved")`, timeoutMs: 4000 },
];

/**
 * Save the seller of each Mark II auction from its listing page, then open My
 * Hammerline and read the Saved sellers list back. Pressing Save seller a
 * second time forgets the seller, and nothing is watched, bid on or bought.
 */
export const markIiSellersWorkflow: ScenarioWorkflow = {
  id: "save-mark-ii-sellers",
  recordingDescription: "Demonstrates saving sellers from their listings and reading the account's saved sellers back.",
  description: "Save the seller of every Kestrel 35 Mk II auction, whatever the listing calls the model, and read the Saved sellers list back; nothing is watched, bid on or bought.",
  recordingScript: [
    ...arrivalSteps("sellers"),
    ...MARK_II_AUCTIONS.flatMap((listing, index) => saveSteps(listing, String(index + 1))),
    { id: "sellers-open-account", operation: "click", target: "role:button:My Hammerline" },
    { id: "sellers-account-open", operation: "waitForState", target: `[data-testid="followed-sellers"]`, timeoutMs: 4000 },
    { id: "extract-saved-sellers", operation: "extract", target: `[data-testid="followed-sellers"] > li`, fields: { seller: ":scope > a" } },
    { id: "sellers-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: accountFacts(FRESH, "sellers-start"),
    extracted: [{ step: "extract-saved-sellers", count: records.length, records }],
    finalState: accountFacts(SAVED, "sellers-saved"),
    allowedConsoleErrors: [],
  },
};
