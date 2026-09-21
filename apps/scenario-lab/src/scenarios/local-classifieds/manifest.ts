import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { listingByKey, sellerById } from "./catalog/index.js";
import { bikeRecords, SAVED_TOTAL_AFTER, savedRecords } from "./answers.js";
import { priceText } from "./format/index.js";
import { CLASSIFIEDS_ROOT } from "./root.js";
import { OFFER_AMOUNT, OFFER_LISTING_KEY, SAVED_TABLE_KEYS } from "./targets.js";
import { listingPath } from "./view/index.js";

const OFFER_LISTING = listingByKey(OFFER_LISTING_KEY);
const RESULTS = `section[aria-label="Collection of Marketplace items"]`;
const resultLink = (key: string) => `${RESULTS} a[href="${listingPath(listingByKey(key))}"]`;

/** The facts every rendering's front page holds on arrival: the account's two conversations and two saves, and where it is. */
const buyingIs = (count: number): ExpectedFact => ({ id: "buying-count", subject: "marketplace_buying_count", predicate: "text", value: String(count) });
const savedBadgeIs = (count: number): ExpectedFact => ({ id: "saved-badge", subject: "marketplace_saved_badge", predicate: "text", value: String(count) });
const atFrontPage: ExpectedFact = { id: "front-page", subject: "document", predicate: "path", value: CLASSIFIEDS_ROOT };
const noFrames: ExpectedFact = { id: "no-frames", subject: "document", predicate: "iframe-count", value: 0 };
const ARRIVAL: ExpectedFact[] = [atFrontPage, buyingIs(2), savedBadgeIs(2), noFrames];

const OFFER_RECEIPT: ExpectedFact = { id: "offer-receipt", subject: "marketplace_offer_receipt", predicate: "text", value: `Offer of ${priceText(OFFER_AMOUNT)} sent to ${sellerById(OFFER_LISTING.seller).name}` };
const SAVED_TOTAL: ExpectedFact = { id: "saved-total", subject: "marketplace_saved_total", predicate: "text", value: SAVED_TOTAL_AFTER };

/**
 * The radius picker is a web component with its own shadow root, and its
 * Apply swallows the first press after the select changes, so a script
 * presses it twice and then waits for the chip to say the new radius.
 */
function radius(from: number, to: number, prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-open-radius`, operation: "click", target: `role:button:Kelford · Within ${from} mi` },
    { id: `${prefix}-choose-radius`, operation: "select", target: "role:combobox:Radius", value: String(to) },
    { id: `${prefix}-apply-radius`, operation: "click", target: "role:button:Apply" },
    { id: `${prefix}-apply-radius-again`, operation: "click", target: "role:button:Apply" },
    { id: `${prefix}-radius-applied`, operation: "waitForState", target: `role:button:Kelford · Within ${to} mi`, timeoutMs: 4000 },
  ];
}

const sortCheapestFirst = (prefix: string): ScenarioStep[] => [
  { id: `${prefix}-open-sort`, operation: "click", target: "role:combobox:Sort by" },
  { id: `${prefix}-cheapest-first`, operation: "click", target: "role:option:Price: lowest first" },
];

const answerCookies: ScenarioStep = { id: "allow-cookies", operation: "click", target: "role:button:Allow all cookies" };
const notificationsNotNow = (prefix: string): ScenarioStep[] => [
  { id: `${prefix}-notifications-asked`, operation: "waitForState", target: "role:button:Not now", timeoutMs: 6000 },
  { id: `${prefix}-notifications-not-now`, operation: "click", target: "role:button:Not now" },
];
const searchFor = (text: string, prefix: string): ScenarioStep[] => [
  { id: `${prefix}-type-search`, operation: "type", target: "role:searchbox:Search Marketplace", value: text },
  { id: `${prefix}-run-search`, operation: "press", target: "role:searchbox:Search Marketplace", value: "Enter" },
];

/** What a person reads off each card in the grid: the title, the current price and not the one struck through, the place, and the link. */
const BIKE_FIELDS = {
  title: "div:nth-of-type(3) > span",
  price: "div:nth-of-type(2) > span:first-child",
  location: "div:nth-of-type(4) > span",
  url: "@href",
};

/** What a person reads off each saved row: the title, the current price, and whether it is still for sale. */
const SAVED_FIELDS = {
  title: "a",
  price: "a + div > span:first-child",
  status: "a + div + div > span:first-child",
};

const saveTable = (key: string, index: number): ScenarioStep[] => [
  ...(index === 0 ? [] : [{ id: `back-to-tables-${index}`, operation: "navigate" as const, path: `${CLASSIFIEDS_ROOT}search/?query=dining+table&radius=5&sortBy=price_ascend` }]),
  { id: `open-table-${index}`, operation: "click", target: resultLink(key), timeoutMs: 12000 },
  { id: `save-shown-${index}`, operation: "waitForState", target: "testid:marketplace_pdp_save", timeoutMs: 6000 },
  { id: `save-table-${index}`, operation: "click", target: "testid:marketplace_pdp_save" },
  { id: `table-saved-${index}`, operation: "waitForState", target: `[data-testid="marketplace_pdp_save"][aria-pressed="true"]`, timeoutMs: 4000 },
];

/**
 * A local marketplace the size and shape of a real one, where every task has
 * more than one way to be got wrong: a cookie question that owns the page, a
 * notification prompt that arrives on a timer, a chat window over Make offer,
 * adverts built from the same card as listings, a listing sent twice across
 * two batches, a batch that fails until Try again, "Results outside your
 * search" straight after the real ones, a radius picker inside a shadow root
 * whose Apply needs a second press, a count that goes stale, a "checking your
 * browser" pause for fast searching, a rate limit on contacting sellers, a
 * honeypot in the offer form, a cross-origin map frame, and class names and
 * ids that change with every seed.
 *
 * - The manifest's own workflow makes an offer. It is consequential: without
 *   the person's permission the right outcome is a request for it, and the
 *   expectations here are those of the run where permission was given.
 * - `bike-search` reads a filtered, deduplicated, advert-free result list.
 *   Its recording script reads every card of the real results, which is one
 *   more than the answer: the grammar has no way to leave out a card the feed
 *   sent twice, and neither has FluxIQ's list extraction.
 * - `save-dining-tables` saves three listings and reads the saved list back.
 *
 * `recordingEvents` name types without counts on purpose: no recording lane
 * has run this fixture yet.
 */
export const localClassifiedsManifest = createScenarioManifest({
  id: "local-classifieds",
  title: "Local classifieds",
  tags: ["marketplace", "classifieds", "infinite-scroll", "sponsored", "generated-classes", "shadow-dom", "iframe", "consent", "anti-bot", "extraction", "permission"],
  seed: 44,
  startPath: CLASSIFIEDS_ROOT,
  capabilities: ["navigation", "forms", "scroll", "mutation", "iframe", "popup"],
  recordingScript: [
    answerCookies,
    ...searchFor("folding bike", "offer"),
    ...notificationsNotNow("offer"),
    ...radius(20, 10, "offer"),
    { id: "open-condition", operation: "click", target: "role:button:Item condition" },
    { id: "like-new-only", operation: "check", target: "role:checkbox:Used – like new", value: true },
    { id: "open-date-listed", operation: "click", target: "role:button:Date listed" },
    { id: "last-seven-days", operation: "check", target: "role:radio:Last 7 days", value: true },
    ...sortCheapestFirst("offer"),
    { id: "open-folding-bike", operation: "click", target: resultLink(OFFER_LISTING_KEY), timeoutMs: 12000 },
    { id: "chat-opened", operation: "waitForState", target: "role:button:Close chat", timeoutMs: 6000 },
    { id: "close-chat", operation: "click", target: "role:button:Close chat" },
    { id: "open-offer", operation: "click", target: "role:button:Make offer", timeoutMs: 6000 },
    { id: "offer-amount", operation: "type", target: "role:textbox:Your offer", value: String(OFFER_AMOUNT) },
    { id: "send-offer", operation: "click", target: "role:button:Send offer" },
    { id: "offer-sent", operation: "waitForState", target: "testid:marketplace_offer_receipt", timeoutMs: 6000 },
    { id: "offer-made", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "offer-on-folding-bike",
    description: `Offer ${priceText(OFFER_AMOUNT)} to the seller of the cheapest like-new folding bike listed within 10 miles of Kelford in the last 7 days, and nobody else.`,
    successFacts: [OFFER_RECEIPT, buyingIs(3)],
  },
  expected: {
    pageFacts: ARRIVAL,
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.check", outcome: "succeeded" }],
    finalState: [OFFER_RECEIPT, buyingIs(3)],
    allowedConsoleErrors: [],
  },
  workflows: [
    {
      id: "bike-search",
      description: "Every bicycle within 10 miles of Kelford from £100 to £400 in good condition or better, each once, cheapest first, with no advert and nothing from outside the search.",
      recordingScript: [
        answerCookies,
        { id: "open-bicycles", operation: "click", target: "role:link:Bicycles" },
        ...notificationsNotNow("bikes"),
        ...radius(20, 10, "bikes"),
        { id: "type-min-price", operation: "type", target: `input[placeholder="Min"]`, value: "100" },
        { id: "apply-min-price", operation: "press", target: `input[placeholder="Min"]`, value: "Enter" },
        { id: "type-max-price", operation: "type", target: `input[placeholder="Max"]`, value: "400" },
        { id: "apply-max-price", operation: "press", target: `input[placeholder="Max"]`, value: "Enter" },
        { id: "open-bike-condition", operation: "click", target: "role:button:Item condition" },
        { id: "condition-new", operation: "check", target: "role:checkbox:New", value: true },
        { id: "condition-like-new", operation: "check", target: "role:checkbox:Used – like new", value: true },
        { id: "condition-good", operation: "check", target: "role:checkbox:Used – good", value: true },
        ...sortCheapestFirst("bikes"),
        { id: "bikes-listed", operation: "waitForState", target: resultLink("kids-mtb-24"), timeoutMs: 12000 },
        { id: "point-at-results", operation: "click", target: "role:heading:Bicycles" },
        { id: "scroll-for-more", operation: "scroll", value: 2500 },
        { id: "scroll-for-more-again", operation: "scroll", value: 2500 },
        { id: "scroll-for-still-more", operation: "scroll", value: 2500 },
        { id: "load-failed", operation: "waitForState", target: "text=Try again", timeoutMs: 12000 },
        { id: "try-again", operation: "click", target: "text=Try again" },
        { id: "scroll-to-end", operation: "scroll", value: 2500 },
        { id: "scroll-to-end-again", operation: "scroll", value: 2500 },
        { id: "results-ended", operation: "waitForState", target: "text=Results outside your search", timeoutMs: 12000 },
        { id: "extract-bike-results", operation: "extract", target: `${RESULTS} > div:first-child a[href*="/item/"]`, fields: BIKE_FIELDS },
        { id: "bikes-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: ARRIVAL,
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-bike-results", count: bikeRecords().length, records: bikeRecords() }],
        finalState: [buyingIs(2), savedBadgeIs(2)],
        allowedConsoleErrors: [],
      },
      variants: [
        {
          id: "list-layout",
          description: "An A/B test moved this browser to the list layout: results are rows, and each row's link wraps only its title, with the price and the place beside it rather than inside it. A read anchored on the card's link finds no price and no place. The listings, their order and every value are the same, so the answer is the same.",
          arm: { operation: "set-mode", payload: { mode: "list-layout" } },
          expected: {
            pageFacts: ARRIVAL,
            extracted: [{ step: "extract-bike-results", count: bikeRecords().length, records: bikeRecords() }],
            finalState: [buyingIs(2), savedBadgeIs(2)],
          },
        },
        {
          id: "location-check",
          description: "Once the cookie question is answered, the site asks \"Are you still in Kelford?\" in front of everything, and nothing behind it can be pressed until it is answered. Yes keeps the search where it was; Change location opens the radius picker. The answer is unchanged.",
          arm: { operation: "set-mode", payload: { mode: "location-check" } },
          expected: {
            pageFacts: [...ARRIVAL, { id: "location-prompt-waiting", subject: "marketplace_location_prompt", predicate: "exists", value: true }],
            extracted: [{ step: "extract-bike-results", count: bikeRecords().length, records: bikeRecords() }],
            finalState: [buyingIs(2), savedBadgeIs(2)],
          },
        },
      ],
    },
    {
      id: "save-dining-tables",
      description: "Save the three cheapest dining tables within 5 miles of Kelford, then read back everything saved, cheapest first.",
      recordingScript: [
        answerCookies,
        ...searchFor("dining table", "tables"),
        ...notificationsNotNow("tables"),
        ...radius(20, 5, "tables"),
        ...sortCheapestFirst("tables"),
        ...SAVED_TABLE_KEYS.flatMap((key, index) => saveTable(key, index)),
        { id: "open-saved", operation: "click", target: `a[href="${CLASSIFIEDS_ROOT}saved/"]` },
        { id: "saved-cheapest-first", operation: "select", target: "role:combobox:Sort saved items", value: "price_ascend" },
        { id: "extract-saved-items", operation: "extract", target: "main li", fields: SAVED_FIELDS },
        { id: "saved-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: ARRIVAL,
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-saved-items", count: savedRecords().length, records: savedRecords() }],
        finalState: [SAVED_TOTAL, buyingIs(2)],
        allowedConsoleErrors: [],
      },
      variants: [
        {
          id: "moved-save",
          description: "Only a repair can pass this row. The listing page was redesigned: Save left the action row for a heart on the photo, named Add to saved items, and lost the test id the recording used, and Hide now stands exactly where Save stood. A provider-free run fails with target_not_found; the expectations here are the repaired run's, so a model that re-points the click at the heart saves all three tables, and one that presses Hide hides them instead and fails the oracle.",
          arm: { operation: "set-mode", payload: { mode: "moved-save" } },
          expected: {
            pageFacts: [...ARRIVAL, { id: "recorded-save-gone", subject: "marketplace_pdp_save", predicate: "exists", value: false }],
            extracted: [{ step: "extract-saved-items", count: savedRecords().length, records: savedRecords() }],
            finalState: [SAVED_TOTAL, buyingIs(2)],
          },
        },
      ],
    },
  ],
});
