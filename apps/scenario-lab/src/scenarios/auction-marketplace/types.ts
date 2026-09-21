/**
 * The marketplace's vocabulary: a listing, the person's session, and the
 * renderings the fixture can be armed into.
 *
 * `baseline` is Hammerline as it ships. Each armed rendering is one thing a
 * real marketplace does between the day a Flow was made and the day it runs:
 *
 * - `grid-view` -- an A/B test moved this visitor onto the gallery layout, so
 *   every result card has a different structure and the same text.
 * - `feedback-survey` -- a satisfaction survey now interrupts the second
 *   results page a visitor loads, modal, until it is answered or declined.
 * - `watch-redesign` -- the listing page was redesigned: Add to Watchlist is
 *   gone, a heart labelled Save item sits on the photo, and Save this seller
 *   stands where the watch button stood.
 */
export const auctionModes = ["baseline", "grid-view", "feedback-survey", "watch-redesign"] as const;

export type AuctionMode = (typeof auctionModes)[number];

export type Currency = "GBP" | "EUR" | "USD";

/**
 * How a listing sells. `auction-bin` is an auction that also offers Buy it
 * now until the first bid meets the reserve; `fixed-offer` is fixed price
 * with Best Offer.
 */
export type ListingFormat = "auction" | "auction-bin" | "fixed" | "fixed-offer";

export type ListingCondition = "Pre-owned" | "Seller refurbished" | "For parts or not working";

/** Amounts are minor units of the listing's own currency. */
export type Postage = { kind: "free" } | { kind: "paid"; amount: number } | { kind: "collection"; place: string };

/**
 * One listing. Amounts are minor units (pence, cents) of the listing's own
 * currency; times are minutes from the marketplace's fixed reference clock,
 * never the wall clock, so a run on any day reads the same page.
 */
export type Listing = {
  /** The twelve-digit item number, shown on the listing page and in its address. */
  id: string;
  title: string;
  subtitle: string;
  brand: string;
  /** The seller-entered Model item specific, which is what the Model filter reads. It is sometimes wrong, as it is on real listings. */
  model: string;
  /** The seller-entered Type item specific, which the Type filter reads. */
  type: string;
  format: ListingFormat;
  condition: ListingCondition;
  currency: Currency;
  /** The current bid of an auction, or the price of a fixed-price listing (the lowest variation's, with `priceTo` the highest). */
  price: number;
  priceTo?: number;
  bids: number;
  binPrice?: number;
  /** The current high bidder's hidden maximum, which a new bid has to beat. */
  competitorMax?: number;
  postage: Postage;
  /** Minutes from the reference clock to the end of an auction; absent for fixed price. */
  endsIn?: number;
  listedAgo: number;
  seller: string;
  watchers: number;
  /** Still in the search index, already over: counted in every total, shown nowhere. */
  ended?: true;
  /** What a variation picker offers, for a listing sold in variations. */
  variations?: ReadonlyArray<{ label: string; price: number }>;
  description: readonly string[];
};

export type Seller = { id: string; location: string; feedback: number; positive: string; since: number };

/** A bid the person placed, as the marketplace resolved it against the current high bidder's hidden maximum. */
export type PlacedBid = { itemId: string; maxBid: number; current: number; winning: boolean };

/** What the last watch toggle did, which the page reads back to show the heart or the rate-limit notice. */
export type WatchOutcome = { itemId: string; outcome: "watching" | "removed" | "rate-limited"; retryAfter: number };

/** What the last bid attempt did, which the bid drawer reads back. */
export type BidOutcome = {
  itemId: string;
  outcome: "winning" | "outbid" | "below-minimum" | "rate-limited" | "restricted" | "invalid";
  message: string;
};

/**
 * One visitor's session. Everything the run changes is here and is rendered
 * back on every page, so a reload shows what the run did and the page and the
 * oracle cannot disagree.
 *
 * Two fields carry wall-clock milliseconds, and only these two: the watch and
 * bid rate limits are measured in real seconds, as a real limiter's are. A
 * fresh session holds none, so the state a run starts from is identical for
 * every seed and every hour.
 */
export type AuctionState = {
  mode: AuctionMode;
  consent: "pending" | "accepted" | "rejected";
  promoDismissed: boolean;
  surveyDismissed: boolean;
  greetingDismissed: boolean;
  /** Results pages served, which the rotating ids, the challenge and the survey count. */
  resultsViews: number;
  challengePassed: boolean;
  watched: string[];
  followed: string[];
  bids: PlacedBid[];
  purchases: string[];
  /** Set by a filled honeypot; bidding and buying are refused for the rest of the session. */
  restricted: boolean;
  watchToggleTimes: number[];
  lastBidAttemptAt: number | null;
  lastWatch: WatchOutcome | null;
  lastBid: BidOutcome | null;
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
};
