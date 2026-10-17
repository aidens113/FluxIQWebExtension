import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../catalog/index.js";
import { ACCOUNT_LITERALS } from "./account-literals.js";
import { SHARED_STEPS } from "./shared-steps.js";

const FAMILY_CARD = TIDEWELL_KETTLES[0]?.sku ?? "";

/** The cart exactly as the account starts: nothing was put in place of the kettle that cannot be bought. */
const RECORDS = [
  { item: "Ridgeline Slim Case for Aurel 8 Pro, Shockproof Phone Case with Raised Edges, Midnight", quantity: "1", price: "$19.99" },
  { item: "Brightaisle Basics AA Alkaline Batteries, 48 Count", quantity: "1", price: "$17.49" },
];

/**
 * The conditional case: add the Sage Green 1.0 L Tidewell kettle only if it
 * can be bought. It cannot -- its page says "Currently unavailable." and has
 * no buy box -- so the right end is the cart unchanged, read back.
 *
 * Every substitute is one click away and wrong: the Sage Green 1.7 L the
 * finish swatch opens on, the 1.0 L in another finish, and the marketplace
 * offers on the 1.7 L listings. Each adds a line, which the account fact sees.
 */
export const UNAVAILABLE_KETTLE_WORKFLOW: ScenarioWorkflow = {
  id: "unavailable-sage-kettle",
  recordingDescription: "Demonstrates checking a variant's availability and leaving the cart unchanged when it cannot be bought.",
  description: "Open the Sage Green 1.0 L Tidewell kettle, find it unavailable, add nothing in its place, and read back the active cart.",
  recordingScript: [
    ...SHARED_STEPS.openStore,
    ...SHARED_STEPS.search("sage", "tidewell kettle"),
    { id: "sage-kettle-listed", operation: "waitForState", target: `[data-component="search-result"][data-sku="${FAMILY_CARD}"]`, timeoutMs: 6000 },
    { id: "sage-open-kettle", operation: "click", target: `[data-component="search-result"][data-sku="${FAMILY_CARD}"]:not([data-ad-id]) h2 a` },
    { id: "sage-chat-opened", operation: "waitForState", target: "role:dialog:Brightaisle Assistant", timeoutMs: 9000 },
    { id: "sage-minimize-chat", operation: "click", target: "role:button:Minimize chat" },
    { id: "sage-choose-sage", operation: "click", target: `[title="Click to select Sage Green"]` },
    { id: "sage-app-banner", operation: "waitForState", target: `[title="Close"]`, timeoutMs: 6000 },
    { id: "sage-close-app-banner", operation: "click", target: `[title="Close"]` },
    { id: "sage-choose-small", operation: "click", target: `[data-href$="/dp/B0D7KX1S10"]` },
    { id: "sage-unavailable", operation: "waitForState", target: `text=We don't know when or if this item will be back in stock.`, timeoutMs: 6000 },
    { id: "sage-cart", operation: "navigate", path: STORE_PATHS.cart },
    { id: "extract-cart-unchanged", operation: "extract", target: `[data-name="Active Items"] [data-line]`, fields: { item: `a[href*="/dp/"] > span`, quantity: `[aria-live="polite"]`, price: ":scope > p > span" } },
    { id: "sage-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [ACCOUNT_LITERALS.startFact("sage-start")],
    extracted: [{ step: "extract-cart-unchanged", count: RECORDS.length, records: RECORDS }],
    finalState: [ACCOUNT_LITERALS.accountFact("sage-account-unchanged", ACCOUNT_LITERALS.start), ACCOUNT_LITERALS.checkoutFact("sage-no-checkout", "null"), SHARED_STEPS.notChallenged],
    allowedConsoleErrors: [],
  },
};
