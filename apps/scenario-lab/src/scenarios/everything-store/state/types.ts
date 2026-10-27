/**
 * The store's server-side state, which is also the fixture's oracle
 * (`/__control/final-state`). Everything a run changes is here; everything a
 * page shows is derived from it.
 *
 * `mode` is the rendering the fixture is armed into:
 *
 * - `baseline` -- the store as it ships.
 * - `redesigned-header` -- the header was redesigned between a recording and a
 *   run: the search button lost the test id the recording names and moved
 *   left, and a "Search with your camera" button now stands where it stood.
 * - `deal-wheel` -- a promotion shipped: every results page throws a
 *   spin-to-win wheel over an inert page as it renders, until it is answered.
 * - `robot-check` -- the store has decided this session looks automated and
 *   answers every page with its type-the-characters challenge, which only a
 *   person can pass.
 * - `keyboard-suggestions` -- the header's suggestion list was rebuilt as an
 *   accessible combobox: the arrow keys move a highlight through the
 *   suggestions, and Enter on a highlighted one puts it in the search box
 *   for the shopper to refine, without searching. Enter with nothing
 *   highlighted searches as before.
 * - `reworded-prompt` -- the notifications prompt was redesigned and its copy
 *   rewritten: "Not now" now reads "Not right now", on a new component with new
 *   classes and ids, and the old words were left behind in the button's
 *   `aria-label`, a label-in-name mismatch stores really ship.
 * - `help-and-offers` -- the cart page gained a "Help and offers" area, built
 *   by other teams and shipped with their rough edges: help topics as in-page
 *   tabs, a scrolling list of delivery questions whose "Still need help?" bar
 *   is pinned over the last question, a lightning deal (for a cart holding
 *   the descaler) with a ticking clock and a "Claim deal" link that only
 *   ripples, a deals strip whose filters
 *   answer in place, a promo whose terms link is cancelled by a handler with
 *   nothing behind it, and an also-viewed pager that raises its busy flag and
 *   never loads.
 *
 * No workflow variant arms the last three; they are renderings a browser test
 * arms with `set-mode` to meet a real storefront's keyboard handling, a
 * control whose words changed while its name stood, and links a page answers
 * in place, or fails to answer at all.
 */
export const storeModes = ["baseline", "redesigned-header", "deal-wheel", "robot-check", "keyboard-suggestions", "reworded-prompt", "help-and-offers"] as const;

export type StoreMode = (typeof storeModes)[number];

export type NudgeState = "pending" | "dismissed";

/** The support chat: never touched, opened (by the shopper or by itself), or minimised to its bubble. */
export type ChatState = "idle" | "open" | "minimized";

/**
 * One line of the cart or of Saved for later. `offerId` is a marketplace
 * seller's offer, or null for the store's own. `selected` is whether the line
 * goes to checkout, which the cart remembers per line.
 */
export type CartLine = { lineId: string; sku: string; offerId: string | null; quantity: number; selected: boolean };

export type AddressId = "home" | "office";
export type PaymentId = "visa-4417" | "store-card-0932" | "checking-7781";
export type DeliveryOptionId = "brightaisle-day" | "standard" | "one-day";

/** A line as checkout and the order hold it, priced when it entered checkout. */
export type OrderLine = { sku: string; offerId: string | null; quantity: number; unitCents: number };

/**
 * An open checkout. `pipeline` is how it was entered: from the cart (every
 * selected line) or by Buy Now (one listing, leaving the cart alone). The
 * store opens it on its own preferences: Brightaisle Day delivery rather than
 * standard, and the Plus free trial ticked.
 */
export type CheckoutSession = {
  pipeline: "cart" | "buy-now";
  lines: OrderLine[];
  addressId: AddressId;
  paymentId: PaymentId;
  giftCard: boolean;
  delivery: DeliveryOptionId;
  plusTrial: boolean;
};

export type PlacedOrder = Omit<CheckoutSession, "pipeline"> & { orderId: string; pipeline: CheckoutSession["pipeline"]; totalCents: number };

/**
 * The store's defences. `searchLoads` are the times of recent results-page
 * requests, for the rate limiter; `throttled` counts the requests it refused;
 * `flagged` is why the session was judged automated, if it was. `robot` is
 * the hard challenge: which image is showing, how many wrong answers it has
 * had, and whether a person has passed it. `saveGlitch` is the cart's flaky
 * Save for later, which fails its first request of a session.
 */
export type GuardState = {
  softCheck: "pending" | "passed";
  searchLoads: number[];
  throttled: number;
  flagged: "honeypot" | "rate-limit" | null;
  robot: { image: number; wrong: number; solved: boolean };
  saveGlitch: "armed" | "spent";
};

export type StoreState = {
  /** The lab seed, kept only to draw the robot check's characters; nothing else reads it. */
  challengeSeed: number;
  mode: StoreMode;
  consent: "pending" | "accepted" | "declined";
  nudges: { appBanner: NudgeState; notifications: NudgeState; dealWheel: NudgeState; chat: ChatState };
  guard: GuardState;
  cart: CartLine[];
  saved: CartLine[];
  nextLine: number;
  checkout: CheckoutSession | null;
  orders: PlacedOrder[];
  newsletter: "none" | "subscribed";
  /** Operations the store accepted, oldest first, capped. */
  activity: string[];
};
