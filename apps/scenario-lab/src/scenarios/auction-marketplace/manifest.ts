import type { ExpectedFact, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";
import { currentPrice, listingByHandle, moneyText } from "./catalog/index.js";
import { cardSlots, flyoutTexts, watchedListings } from "./pages/index.js";
import { itemPath, MARKET_ROOT, WATCHLIST_SUBPATH } from "./paths.js";
import { applyAuctionMutation, createAuctionState } from "./state.js";
import type { AuctionState, Listing } from "./types.js";

/** The auction the bid workflow bids on: harrow_cameras' Kestrel 35, at £78.00 with a rival's hidden maximum of £82.00. */
export const BID_TARGET: Listing = listingByHandle("m7");
/** The maximum the bid workflow enters, as a person types it. */
export const BID_AMOUNT = "85.00";
/**
 * The original Kestrel 35 auctions a person asking for "every Kestrel 35
 * auction, not for parts, under £150" is owed, whatever route they take to
 * them: the site's filters, used carefully, or the keyword results read and
 * judged one by one. Ten, in the order they end.
 */
export const KESTREL_AUCTIONS: readonly Listing[] = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"]
  .map((handle) => listingByHandle(handle))
  .sort((left, right) => (left.endsIn ?? 0) - (right.endsIn ?? 0));
/**
 * What "watch every Kestrel 35 auction ending before Tuesday midnight under
 * £100" adds: three auctions. A fourth, `m3`, qualifies and is already
 * watched, so pressing its heart again would take it off.
 */
export const WATCH_ADDITIONS: readonly Listing[] = ["m1", "m2", "m4"].map((handle) => listingByHandle(handle));

const FRESH = createAuctionState();
const WATCHED = WATCH_ADDITIONS.reduce((state: AuctionState, listing, index) => applyAuctionMutation(state, "toggle-watch", { itemId: listing.id }, index * 60_000), FRESH);
const BID_PLACED = applyAuctionMutation(FRESH, "place-bid", { itemId: BID_TARGET.id, amount: BID_AMOUNT, reference: "" }, 0);

/** The account's four lists, as the header's flyouts spell them in `state`. */
function accountLists(state: AuctionState, prefix: string): ExpectedFact[] {
  const texts = flyoutTexts(state);
  return [
    { id: `${prefix}-watchlist`, subject: "watch-flyout", predicate: "text", value: texts.watch },
    { id: `${prefix}-bids`, subject: "bids-flyout", predicate: "text", value: texts.bids },
    { id: `${prefix}-purchases`, subject: "purchases-flyout", predicate: "text", value: texts.purchases },
    { id: `${prefix}-saved-sellers`, subject: "followed-sellers", predicate: "text", value: texts.followed },
  ];
}

const watchControlShown: ExpectedFact = { id: "watch-control-shown", subject: "x-watch-cta", predicate: "exists", value: true };
const watchControlGone: ExpectedFact = { id: "watch-control-gone", subject: "x-watch-cta", predicate: "exists", value: false };
const HOME_AT_LOAD = [...accountLists(FRESH, "start"), watchControlShown];

/**
 * Steps every workflow opens with: what the home page throws at a visit,
 * answered in the one order that holds however late the first step comes.
 * First the app promotion, whose scrim covers everything, the cookie banner
 * included, 2.5 s into the page; then the assistant's greeting, 3.5 s in,
 * over the lower right of every page, the bid drawer's foot among it; then
 * the cookie banner. Each answer lasts for the session, so no later page
 * brings them back. A Flow replayed from the recording starts long after all
 * three have arrived, and meets them in this order too. The two that arrive
 * on a timer are certain to come, so each is waited for generously: on a
 * loaded machine their timers fire late.
 */
const SEARCH_BOX = `form[role="search"] input[name="_nkw"]`;
const ARRIVE: ScenarioStep[] = [
  { id: "promotion-shown", operation: "waitForState", target: "role:dialog:Bid on the go", timeoutMs: 15_000 },
  { id: "decline-promotion", operation: "click", target: `div[role="dialog"] span:text-is("Not now")` },
  { id: "greeting-shown", operation: "waitForState", target: "#hal-greeting", timeoutMs: 15_000 },
  { id: "close-greeting", operation: "click", target: "#hal-greeting .hal-close" },
  { id: "accept-cookies", operation: "click", target: "role:button:Accept all" },
];
const SEARCH_STEPS: ScenarioStep[] = [
  ...ARRIVE,
  { id: "search-for-camera", operation: "type", target: SEARCH_BOX, value: "kestrel 35" },
  { id: "run-search", operation: "press", target: SEARCH_BOX, value: "Enter" },
  { id: "results-hydrated", operation: "waitForState", target: `ul[aria-busy="false"]`, timeoutMs: 5000 },
];

/** A rail checkbox link by its label, and the same link once it is ticked. */
const railOption = (section: string, label: string) => `section[aria-label="${section}"] a[role="checkbox"]:has(span:text-is("${label}"))`;
const railChosen = (section: string, label: string) => `section[aria-label="${section}"] a[role="checkbox"][aria-checked="true"]:has(span:text-is("${label}"))`;

/**
 * The extraction reads organic cards only -- the advertisements are marked
 * with a different attribute -- and every field by its position in the card,
 * because position is all the page offers: the classes are build hashes that
 * change with the seed and the ids change on every page served.
 */
const RESULT_CARDS = `ul[aria-busy] > li[data-listingid]`;
const cardFields = {
  title: `:scope > div:nth-child(2) > a span:last-child`,
  price: `:scope > div:nth-child(2) > div:nth-child(4) > span:first-child`,
  bids: `:scope > div:nth-child(2) > div:nth-child(5) > span:first-child`,
  postage: `:scope > div:nth-child(2) > div:nth-child(7) > span:first-child`,
};

function kestrelRecords(): Array<Record<string, string>> {
  return KESTREL_AUCTIONS.map((listing) => {
    const slots = cardSlots(listing, FRESH);
    return { title: listing.title, price: slots[0]!, bids: slots[2]!, postage: slots[6]! };
  });
}

function watchlistRecords(): Array<Record<string, string>> {
  return watchedListings(WATCHED).map((listing) => ({ title: listing.title, price: moneyText(listing.currency, currentPrice(listing, WATCHED.bids)) }));
}

const watchSteps = (listing: Listing, ordinal: string): ScenarioStep[] => [
  { id: `open-${ordinal}`, operation: "navigate", path: itemPath(listing.id) },
  { id: `watch-${ordinal}`, operation: "click", target: "testid:x-watch-cta" },
  { id: `${ordinal}-watched`, operation: "waitForState", target: `[data-testid="x-watch-cta"][aria-pressed="true"]`, timeoutMs: 4000 },
];

const kestrelExpected = {
  extracted: [{ step: "extract-kestrel-auctions", count: KESTREL_AUCTIONS.length, records: kestrelRecords() }],
  finalState: accountLists(FRESH, "unchanged"),
};

const watchExpected = {
  extracted: [{ step: "extract-watchlist", count: watchlistRecords().length, records: watchlistRecords() }],
  finalState: accountLists(WATCHED, "watched"),
};

/**
 * Hammerline, an online auction marketplace, cut down to one corner of it --
 * film cameras -- and kept as messy as the real thing: a cookie banner across
 * the bottom of the window, an app promotion that arrives a couple of seconds
 * after the page, a chat assistant whose greeting opens over the bid button,
 * a bot check on the fourth results page, a watch limiter and a hidden bot
 * trap in the bid form; results that arrive as skeletons, classes that are
 * build hashes per seed, ids that change on every page, advertisements mixed
 * into the results, pages that overlap by two, a Next arrow that stops
 * working on page two, a sort button that ignores its first press and a
 * Condition filter that silently resets the buying format; prices written in
 * pounds, in euros the Dutch and German way and in dollars, with the site's
 * own pound estimate beside them; and around the Kestrel 35 every listing a
 * search for it really turns up -- the 35S, the Mark II, the 350, the same
 * camera for parts or at fixed price, a lens and a case whose sellers filled
 * in the camera's model, two different auctions with the same title.
 *
 * Three workflows, three kinds of job. The manifest's own script places a bid
 * -- consequential, so a run with no grant must stop and ask the person first.
 * `watch-endings` changes the account: it watches three auctions and reads the
 * watchlist back. `kestrel-auctions` reads: every genuine Kestrel 35 auction
 * under £150, once each, soonest first. Its two variants are the existing-Flow
 * entry point -- a gallery layout and a survey that was never there before --
 * and `watch-endings`'s variant is the repair entry point.
 *
 * `recordingEvents` name types without counts on purpose: no recording lane
 * has run this fixture yet.
 */
export const auctionMarketplaceManifest = createScenarioManifest({
  id: "auction-marketplace",
  title: "Auction marketplace",
  tags: ["marketplace", "auction", "search", "filters", "pagination", "generated-classes", "overlays", "anti-bot", "iframe", "shadow-dom", "consequential", "extraction", "locale"],
  seed: 4040,
  startPath: MARKET_ROOT,
  capabilities: ["navigation", "forms", "mutation", "scroll", "iframe", "popup"],
  recordingScript: [
    ...SEARCH_STEPS,
    { id: "open-listing", operation: "click", target: `li[data-listingid="${BID_TARGET.id}"] a:has([role="heading"])` },
    { id: "listing-open", operation: "waitForState", target: "role:button:Place bid", timeoutMs: 5000 },
    { id: "open-bid", operation: "click", target: "role:button:Place bid" },
    { id: "enter-max-bid", operation: "type", target: `input[name="maxbid"]`, value: BID_AMOUNT },
    { id: "review-bid", operation: "click", target: `div[role="dialog"] div:text-is("Review bid")` },
    { id: "confirm-bid", operation: "click", target: "role:button:Confirm bid" },
    { id: "bid-settled", operation: "waitForState", target: `div[role="dialog"] [role="status"]`, timeoutMs: 5000 },
    { id: "bid-placed", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "bid-on-harrow-kestrel",
    description: `A maximum bid of £85 is placed on the Kestrel 35 that harrow_cameras is auctioning, leaving the person its highest bidder, and nothing else on the account changes.`,
    successFacts: accountLists(BID_PLACED, "goal"),
  },
  expected: {
    pageFacts: HOME_AT_LOAD,
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
    finalState: accountLists(BID_PLACED, "bid"),
    allowedConsoleErrors: [],
  },
  workflows: [
    {
      id: "watch-endings",
      description: "Watch the three original Kestrel 35 auctions under £100 that end before Tuesday midnight and are not watched yet, leave the one already watched alone, and read the watchlist back.",
      recordingScript: [
        ...ARRIVE,
        ...watchSteps(WATCH_ADDITIONS[0]!, "first"),
        ...watchSteps(WATCH_ADDITIONS[1]!, "second"),
        ...watchSteps(WATCH_ADDITIONS[2]!, "third"),
        { id: "open-watchlist", operation: "navigate", path: `${MARKET_ROOT}${WATCHLIST_SUBPATH}` },
        { id: "watchlist-open", operation: "waitForState", target: `ol[aria-label="Watchlist items"]`, timeoutMs: 4000 },
        { id: "extract-watchlist", operation: "extract", target: `ol[aria-label="Watchlist items"] > li`, fields: { title: ":scope > div > a", price: ":scope > div > div:nth-child(2) > span:first-child" } },
        { id: "watchlist-read", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: HOME_AT_LOAD,
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        ...watchExpected,
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "watch-redesign",
        description: "Only a repair can pass this row. The listing page was redesigned: Add to Watchlist and its test hook are gone, a heart labelled Save item sits on the photo, and a Save this seller button stands where the watch button stood. A provider-free run fails with target_not_found; the expectations here are the repaired run's, so a repair that re-points the click at Save item passes, and one that presses Save this seller saves three sellers, watches nothing, and fails the oracle.",
        arm: { operation: "set-mode", payload: { mode: "watch-redesign" } },
        expected: {
          pageFacts: [watchControlGone, ...accountLists(FRESH, "redesign-start")],
          actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
          ...watchExpected,
        },
      }],
    },
    {
      id: "kestrel-auctions",
      description: "Collect every original Kestrel 35 auction that is not for parts and is under £150 at the site's pound estimate, once each, soonest ending first, by narrowing the results with the site's own filters.",
      recordingScript: [
        ...SEARCH_STEPS,
        { id: "only-pre-owned", operation: "click", target: railOption("Condition", "Pre-owned") },
        { id: "pre-owned-applied", operation: "waitForState", target: railChosen("Condition", "Pre-owned"), timeoutMs: 5000 },
        { id: "also-refurbished", operation: "click", target: railOption("Condition", "Seller refurbished") },
        { id: "refurbished-applied", operation: "waitForState", target: railChosen("Condition", "Seller refurbished"), timeoutMs: 5000 },
        { id: "only-auctions", operation: "click", target: `nav[aria-label="Buying format"] a:text-is("Auction")` },
        { id: "check-shown", operation: "waitForState", target: "role:button:Continue", timeoutMs: 6000 },
        { id: "pass-check", operation: "click", target: "role:button:Continue" },
        { id: "auctions-applied", operation: "waitForState", target: `nav[aria-label="Buying format"] a[aria-current="page"]:text-is("Auction")`, timeoutMs: 8000 },
        { id: "open-model", operation: "click", target: `section[aria-label="Model"] > div` },
        { id: "only-kestrel-35", operation: "click", target: railOption("Model", "Kestrel 35") },
        { id: "model-applied", operation: "waitForState", target: railChosen("Model", "Kestrel 35"), timeoutMs: 5000 },
        { id: "open-type", operation: "click", target: `section[aria-label="Type"] > div` },
        { id: "rangefinders", operation: "click", target: railOption("Type", "Rangefinder camera") },
        { id: "rangefinders-applied", operation: "waitForState", target: railChosen("Type", "Rangefinder camera"), timeoutMs: 5000 },
        { id: "film-cameras", operation: "click", target: railOption("Type", "Film camera") },
        { id: "film-cameras-applied", operation: "waitForState", target: railChosen("Type", "Film camera"), timeoutMs: 5000 },
        { id: "max-price", operation: "type", target: `input[name="_udhi"]`, value: "150" },
        { id: "apply-price", operation: "click", target: `section[aria-label="Price"] div[title="Submit price range"]` },
        { id: "price-applied", operation: "waitForState", target: `input[name="_udhi"][value="150"]`, timeoutMs: 5000 },
        { id: "wake-sort", operation: "click", target: "role:button:Sort: Best Match" },
        { id: "open-sort", operation: "click", target: "role:button:Sort: Best Match" },
        { id: "ending-soonest", operation: "click", target: "role:menuitem:Time: ending soonest" },
        { id: "sorted", operation: "waitForState", target: "role:button:Sort: Time: ending soonest", timeoutMs: 5000 },
        { id: "sorted-hydrated", operation: "waitForState", target: `ul[aria-busy="false"]`, timeoutMs: 5000 },
        { id: "extract-kestrel-auctions", operation: "extract", target: RESULT_CARDS, fields: cardFields },
        { id: "auctions-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: HOME_AT_LOAD,
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        ...kestrelExpected,
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "grid-view",
        description: "An A/B test moved this visitor onto the gallery layout. Every result card holds the same text in a different structure, written bottom-up and turned the right way round by a column-reverse layout, so the same listings are owed and a read by the list layout's card positions finds none of them.",
        arm: { operation: "set-mode", payload: { mode: "grid-view" } },
        expected: { pageFacts: HOME_AT_LOAD, ...kestrelExpected },
      }, {
        id: "feedback-survey",
        description: "A satisfaction survey now interrupts the second results page a visitor loads and every one after it, modal, until it is answered or declined. The same listings are owed; a run that never meets the survey on its first page meets it on its second.",
        arm: { operation: "set-mode", payload: { mode: "feedback-survey" } },
        expected: { pageFacts: HOME_AT_LOAD, ...kestrelExpected },
      }],
    },
  ],
});
