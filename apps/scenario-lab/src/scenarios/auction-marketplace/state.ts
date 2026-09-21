import { currentPrice, listingByHandle, listingById, minimumBid, moneyText, parseTypedAmount, resolveBid } from "./catalog/index.js";
import { auctionModes, type AuctionMode, type AuctionState, type BidOutcome, type Listing } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;
/** The watch limiter: a fourth toggle inside five seconds is refused until the oldest of the three falls out of the window. */
const WATCH_WINDOW_MS = 5_000;
const WATCH_LIMIT = 3;
/** A second bid inside ten seconds of a placed one is refused, which is what a double-pressed Confirm meets. */
const BID_COOLDOWN_MS = 10_000;

/**
 * What the person is already watching when the session starts: one genuine
 * Kestrel 35 auction, which a run adding the same kind of listing must leave
 * alone -- pressing its heart again takes it off -- and one lens that has
 * nothing to do with any task.
 */
export const INITIAL_WATCHLIST: readonly string[] = [listingByHandle("m3").id, listingByHandle("n1").id];

function freshState(mode: AuctionMode): AuctionState {
  return {
    mode,
    consent: "pending",
    promoDismissed: false,
    surveyDismissed: false,
    greetingDismissed: false,
    resultsViews: 0,
    challengePassed: false,
    watched: [...INITIAL_WATCHLIST],
    followed: [],
    bids: [],
    purchases: [],
    restricted: false,
    watchToggleTimes: [],
    lastBidAttemptAt: null,
    lastWatch: null,
    lastBid: null,
    activity: [],
  };
}

/** A new visitor's session, identical for every seed. */
export function createAuctionState(): AuctionState {
  return freshState("baseline");
}

/** The fixture's `mutate`: every operation the page can report, timed by the wall clock. */
export function mutateAuctionState(state: AuctionState, operation: string, payload: unknown): AuctionState {
  return applyAuctionMutation(state, operation, payload, Date.now());
}

/**
 * The same, with the clock passed in, which is how the tests reach the rate
 * limits without sleeping. `set-mode` arms a rendering and, like every armed
 * fixture here, starts a fresh session, so an armed run's oracle is its own
 * and never a stale success from the recording. Anything else, or a payload
 * the page could not have sent, leaves the state alone.
 */
export function applyAuctionMutation(state: AuctionState, operation: string, payload: unknown, now: number): AuctionState {
  const body = isRecord(payload) ? payload : {};
  switch (operation) {
    case "set-mode": {
      const mode = auctionModes.find((candidate) => candidate === body.mode);
      return mode === undefined ? state : freshState(mode);
    }
    case "consent":
      return body.choice === "accepted" || body.choice === "rejected" ? log({ ...state, consent: body.choice }, `consent ${body.choice}`) : state;
    case "dismiss-promo":
      return log({ ...state, promoDismissed: true }, "dismissed app promotion");
    case "dismiss-survey":
      return log({ ...state, surveyDismissed: true }, "dismissed survey");
    case "dismiss-greeting":
      return log({ ...state, greetingDismissed: true }, "dismissed chat greeting");
    case "view-results":
      return { ...state, resultsViews: state.resultsViews + 1 };
    case "pass-challenge":
      return log({ ...state, challengePassed: true }, "passed challenge");
    case "toggle-watch":
      return toggleWatch(state, body.itemId, now);
    case "follow-seller":
      return followSeller(state, body.seller);
    case "place-bid":
      return placeBid(state, body, now);
    case "buy-now":
      return buyNow(state, body);
    default:
      return state;
  }
}

function toggleWatch(state: AuctionState, itemId: unknown, now: number): AuctionState {
  const listing = typeof itemId === "string" ? listingById(itemId) : undefined;
  if (!listing || listing.ended) return state;
  const recent = state.watchToggleTimes.filter((at) => now - at < WATCH_WINDOW_MS);
  if (recent.length >= WATCH_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((recent[0]! + WATCH_WINDOW_MS - now) / 1000));
    return log({ ...state, watchToggleTimes: recent, lastWatch: { itemId: listing.id, outcome: "rate-limited", retryAfter } }, `watch refused ${listing.id}`);
  }
  const watching = state.watched.includes(listing.id);
  const watched = watching ? state.watched.filter((id) => id !== listing.id) : [...state.watched, listing.id];
  const outcome = watching ? "removed" : "watching";
  return log({ ...state, watched, watchToggleTimes: [...recent, now], lastWatch: { itemId: listing.id, outcome, retryAfter: 0 } }, `${outcome} ${listing.id}`);
}

function followSeller(state: AuctionState, seller: unknown): AuctionState {
  if (typeof seller !== "string" || !/^[a-z0-9._-]{2,40}$/u.test(seller)) return state;
  const followed = state.followed.includes(seller) ? state.followed.filter((id) => id !== seller) : [...state.followed, seller];
  return log({ ...state, followed }, `follow ${seller}`);
}

function bidOutcome(state: AuctionState, lastBid: BidOutcome, extra: Partial<AuctionState> = {}): AuctionState {
  return log({ ...state, ...extra, lastBid }, `bid ${lastBid.outcome} ${lastBid.itemId}`);
}

function placeBid(state: AuctionState, body: Record<string, unknown>, now: number): AuctionState {
  const listing = typeof body.itemId === "string" ? listingById(body.itemId) : undefined;
  if (!listing || listing.ended || (listing.format !== "auction" && listing.format !== "auction-bin")) return state;
  const itemId = listing.id;
  if (state.restricted) return bidOutcome(state, { itemId, outcome: "restricted", message: RESTRICTED });
  if (typeof body.reference === "string" && body.reference.trim() !== "") {
    return bidOutcome(state, { itemId, outcome: "restricted", message: RESTRICTED }, { restricted: true });
  }
  if (state.lastBidAttemptAt !== null && now - state.lastBidAttemptAt < BID_COOLDOWN_MS) {
    const wait = Math.max(1, Math.ceil((state.lastBidAttemptAt + BID_COOLDOWN_MS - now) / 1000));
    return bidOutcome(state, { itemId, outcome: "rate-limited", message: `You're bidding too quickly. Try again in ${wait} seconds.` });
  }
  const amount = typeof body.amount === "string" ? parseTypedAmount(body.amount) : undefined;
  if (amount === undefined) return bidOutcome(state, { itemId, outcome: "invalid", message: "Enter a valid amount." });
  const minimum = minimumBid(listing, state.bids);
  if (amount < minimum) return bidOutcome(state, { itemId, outcome: "below-minimum", message: `Enter ${moneyText(listing.currency, minimum)} or more.` });
  const placed = resolveBid(listing, state.bids, amount);
  const message = placed.winning
    ? `You're the highest bidder. Current bid: ${moneyText(listing.currency, placed.current)}.`
    : `You've been outbid by an automatic bid. Current bid: ${moneyText(listing.currency, placed.current)}.`;
  return bidOutcome(state, { itemId, outcome: placed.winning ? "winning" : "outbid", message }, { bids: [...state.bids, placed], lastBidAttemptAt: now });
}

const RESTRICTED = "Something went wrong and we couldn't place your bid. Please try again later.";

function buyNow(state: AuctionState, body: Record<string, unknown>): AuctionState {
  const listing = typeof body.itemId === "string" ? listingById(body.itemId) : undefined;
  if (!listing || listing.ended || listing.format === "auction" || state.restricted) return state;
  if (listing.format === "auction-bin" && currentPrice(listing, state.bids) !== listing.price) return state;
  if (typeof body.reference === "string" && body.reference.trim() !== "") return log({ ...state, restricted: true }, `purchase refused ${listing.id}`);
  if (!variationChosen(listing, body.variation)) return state;
  return log({ ...state, purchases: [...state.purchases, listing.id] }, `bought ${listing.id}`);
}

function variationChosen(listing: Listing, variation: unknown): boolean {
  return listing.variations === undefined || listing.variations.some((option) => option.label === variation);
}

function log(state: AuctionState, entry: string): AuctionState {
  return { ...state, activity: [...state.activity, entry].slice(-ACTIVITY_LIMIT) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
