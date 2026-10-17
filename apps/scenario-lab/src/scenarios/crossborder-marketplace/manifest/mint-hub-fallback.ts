import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingById, skuText, storeById, VOLTBAY_OFFICIAL_ID, type SkuChoice } from "../catalog/index.js";
import { miniCartLineText } from "../markup/index.js";
import { marketClasses } from "../styles/index.js";
import { MARKET_SEED } from "./answers.js";
import { cartCount, FIRST_VISIT, ordersShipped } from "./facts.js";
import { SITE_NOISE } from "./site-noise.js";
import { ARRIVE, OPEN_OFFICIAL_LISTING } from "./steps.js";

const c = marketClasses(MARKET_SEED, "baseline");

/**
 * The option set the buyer settles for. The one they asked for first, Mint
 * 10-in-1, is sold out from every warehouse of the official listing
 * (`catalog/skus.ts`); the lookalike "VoltBay Store" has it in stock under the
 * same title, which is the careless way to "find" it.
 */
const FALLBACK: SkuChoice = { color: "Mint", spec: "7-in-1", origin: "Spain" };
const QUANTITY = 2;

/** The cart line the fallback leaves, as the cart page writes it: one row per store, its line's title, options and count. */
function fallbackCartRecord(): Record<string, string> {
  const listing = listingById(VOLTBAY_OFFICIAL_ID)!;
  return { store: storeById(listing.storeId).name, item: listing.title, options: skuText(FALLBACK), quantity: String(QUANTITY) };
}

/**
 * Choose Mint, try the 10-in-1 and meet "sold out", fall back to the 7-in-1
 * shipped from Spain, add two, and read the cart page.
 */
const SCRIPT: ScenarioWorkflow["recordingScript"] = [
  ...ARRIVE,
  ...OPEN_OFFICIAL_LISTING,
  { id: "mint-colour", operation: "click", target: `.${c.swatch}[title="Mint"]` },
  { id: "mint-try-ten-in-one", operation: "click", target: 'text="10-in-1"' },
  { id: "mint-ten-sold-out", operation: "waitForState", target: 'text="This combination is sold out."', timeoutMs: 5000 },
  { id: "mint-seven-in-one", operation: "click", target: 'text="7-in-1"' },
  { id: "mint-from-spain", operation: "click", target: `.${c.skuGroup} >> text="Spain"` },
  { id: "mint-quantity", operation: "type", target: `.${c.qtyInput}`, value: String(QUANTITY) },
  { id: "mint-add-to-cart", operation: "click", target: "testid:add-to-cart" },
  { id: "mint-added", operation: "waitForState", target: 'text="Added to cart!"', timeoutMs: 5000 },
  { id: "mint-open-cart", operation: "click", target: `.${c.cartIcon}` },
  { id: "mint-cart-page", operation: "waitForState", target: `.${c.cartStore}`, timeoutMs: 8000 },
  {
    id: "extract-mint-fallback-cart",
    operation: "extract",
    target: `.${c.cartStore}`,
    fields: { store: ":scope > b", item: `.${c.cartLine} a`, options: `.${c.cartLine} .${c.stockNote}`, quantity: `.${c.qtyRow} > span:not([title])` },
  },
  { id: "mint-hub-fallback-done", operation: "checkpoint" },
];

/** A conditional act: the asked-for option set is sold out, so the stated fallback goes in the cart, and nothing else. */
export const mintHubFallbackWorkflow: ScenarioWorkflow = {
  id: "mint-hub-fallback",
  recordingDescription: "Demonstrates meeting a sold-out option set on a listing and choosing the stated alternative before adding it to the cart.",
  description: "Two of the official Voltbay hub in Mint 10-in-1 from Spain, or, because that is sold out, two in Mint 7-in-1 from Spain; nothing else in the cart, nothing bought.",
  recordingScript: SCRIPT,
  expected: {
    pageFacts: FIRST_VISIT,
    extracted: [{ step: "extract-mint-fallback-cart", count: 1, records: [fallbackCartRecord()] }],
    finalState: [
      { id: "mint-fallback-line", subject: "mini-cart-line", predicate: "text", value: miniCartLineText(VOLTBAY_OFFICIAL_ID, FALLBACK, QUANTITY) },
      cartCount(QUANTITY),
      ordersShipped(0),
    ],
    allowedConsoleErrors: SITE_NOISE,
  },
};
