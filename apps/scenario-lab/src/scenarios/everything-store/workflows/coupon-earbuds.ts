import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { SHARED_STEPS } from "./shared-steps.js";

/**
 * The answer, read off the fixture's catalogue (`catalog/earbuds/earbuds.ts`,
 * relevance ranks 12, 14, 57, 58 and 60) and written out, so the oracle never
 * moves with the generator: every pair of wireless earbuds whose card offers a
 * coupon and prints a rating of 4.0 or higher, in the order an unsorted search
 * first shows them. The coupon is the badge's own words.
 */
const RECORDS = [
  { name: "Brightaisle Basics Sport Wireless Earbuds, Bluetooth 5.3 with Ear Hooks, 36H Playtime, IPX7 Sweatproof, Black", price: "$22.99", coupon: "Save 10%", url: "/scenarios/everything-store/Brightaisle-Basics-Sport-Wireless-Earbuds-Bluetooth-5-3/dp/B0R257NR7U" },
  { name: "Pulsebud Mini Wireless Earbuds, Bluetooth 5.3 Headphones with 36H Playtime, Touch Control, Low Latency Gaming Mode, Rose Gold", price: "$64.99", coupon: "Save 15%", url: "/scenarios/everything-store/Pulsebud-Mini-Wireless-Earbuds-Bluetooth-5-3-Headphones/dp/B0HRN6R1SL" },
  { name: "Trevio T5 Wireless Earbuds, Bluetooth 5.3 Headphones with 50H Playtime, LED Power Display, Deep Bass, Graphite", price: "$69.99", coupon: "Save 15%", url: "/scenarios/everything-store/Trevio-T5-Wireless-Earbuds-Bluetooth-5-3-Headphones/dp/B03NPLG2WK" },
  { name: "Soundcrest Air Pro 2 Wireless Earbuds, Bluetooth 5.3 Headphones with 36H Playtime, LED Power Display, Built-in Mic, Graphite", price: "$34.99", coupon: "Save $5.00", url: "/scenarios/everything-store/Soundcrest-Air-Pro-2-Wireless-Earbuds-Bluetooth-5/dp/B016CBKJ2R" },
  { name: "Novaq Life Beam Wireless Earbuds, Bluetooth 5.3 Headphones with 60H Playtime, Deep Bass, IPX7 Waterproof, Rose Gold", price: "$69.99", coupon: "Save $5.00", url: "/scenarios/everything-store/Novaq-Life-Beam-Wireless-Earbuds-Bluetooth-5-3/dp/B0811CJZQX" },
];

/** An organic card with a coupon badge: the only span that sits directly under the block after the price. */
const COUPON_CARDS = `[data-component="search-result"][data-sku]:not([data-ad-id]):has([itemprop="offers"] + div > span)`;

/**
 * Every pair of wireless earbuds with a coupon and a rating of 4.0 or higher,
 * across all five pages of results.
 *
 * The coupons are spread over pages one, two, four and five, so a read of the
 * first page finds two of the five. Four couponed pairs fail the rating: two
 * at 3.8, which the store's "4 Stars & Up" filter admits because it rounds to
 * the star icon, a 3.7 and a 3.3. Sponsored cards carry no coupon, and the
 * pages' boundary repeats carry none either, so a careful reader keeps
 * exactly five rows.
 *
 * As with `plus-under-fifty`, no recording of this workflow runs: its extract
 * step pages and keeps every couponed card, rating unread, and FluxIQ's read
 * reads one page (`pagedExtractExclusion`). The step describes the list for
 * the Lab; the dataset is the created-Flow lane's judgement, and the honest
 * path test sweeps the five pages by hand.
 */
export const COUPON_EARBUDS_WORKFLOW: ScenarioWorkflow = {
  id: "coupon-earbuds",
  recordingDescription: "Demonstrates reading coupon badges and ratings across every page of results.",
  description: "Find every pair of wireless earbuds whose search card offers a coupon and shows a rating of 4.0 or higher, across every page of results, leaving out sponsored placements, each once, in results order.",
  recordingScript: [
    ...SHARED_STEPS.openStore,
    ...SHARED_STEPS.search("coupon", "wireless earbuds"),
    { id: "coupon-results", operation: "waitForState", target: `[data-component="search-result"][data-sku][data-index="1"]`, timeoutMs: 6000 },
    { id: "coupon-scroll-down", operation: "scroll", value: 6000 },
    {
      id: "extract-coupon-earbuds",
      operation: "extract",
      target: COUPON_CARDS,
      fields: {
        name: "h2 a span",
        price: `[itemprop="offers"] > a > span > span:first-child`,
        coupon: `[itemprop="offers"] + div > span`,
        url: "h2 a@href",
      },
      pagination: { next: `a[aria-label^="Go to next page"]`, maxPages: 5 },
    },
    { id: "coupon-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [...SHARED_STEPS.homeFacts],
    extracted: [{ step: "extract-coupon-earbuds", count: RECORDS.length, records: RECORDS }],
    finalState: [SHARED_STEPS.notChallenged, { id: "nothing-added", subject: "cart-count", predicate: "text", value: "2" }],
    allowedConsoleErrors: [],
  },
};
