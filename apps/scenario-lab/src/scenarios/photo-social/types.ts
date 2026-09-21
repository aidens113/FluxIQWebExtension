/**
 * Framelight's vocabulary: who is on it, what they posted, what a visitor can
 * change, and the renderings the fixture can be armed into.
 *
 * - `baseline` -- the site as it ships.
 * - `consent-redesign` -- the cookie dialog moved to a new consent vendor. The
 *   decline control the recording pressed lost its test id and now reads "Only
 *   allow essential cookies"; "Allow all cookies" kept its test id and stands
 *   first. Only a repair that re-points the press at the essential-only control
 *   passes, because the armed run is judged on consent being declined.
 * - `verified-upsell` -- a subscription upsell ("Get verified") opens over a
 *   post shortly after it loads and makes the page behind it inert until it is
 *   answered. Its primary button starts a paid subscription; "Not now" is the
 *   answer. A Flow built without it meets it at run time.
 */
export const photoModes = ["baseline", "consent-redesign", "verified-upsell"] as const;

export type PhotoMode = (typeof photoModes)[number];

export type ConsentChoice = "pending" | "essential" | "all";

export type Account = {
  handle: string;
  name: string;
  verified: boolean;
  followers: number;
  following: number;
  bio: string;
  /** Shown under the name for business profiles. */
  category: string;
  /** The link in bio, without a scheme; empty for none. */
  link: string;
  /** Avatar colour. */
  hue: number;
};

export type PostKind = "photo" | "carousel" | "reel";

export type Post = {
  /** The shortcode in the post's address. */
  code: string;
  author: string;
  /** Publication day, ISO `YYYY-MM-DD`; every post goes out at noon UTC. */
  date: string;
  kind: PostKind;
  /** Images in a carousel; 1 otherwise. */
  slides: number;
  /** `null` when the author hides the like count. */
  likes: number | null;
  /** Reels only. */
  plays: number;
  caption: string;
  /** Empty when the post names no place. */
  location: string;
  /** What the automatic alt text says the photo may show. */
  subject: string;
  pinned: boolean;
  /** Sponsored placement in the home feed. */
  sponsored: boolean;
};

export type Comment = {
  /** A long numeric id, as the comment's permalink carries it. */
  id: string;
  author: string;
  date: string;
  text: string;
  likes: number;
  pinned: boolean;
  replies: readonly Comment[];
};

/** One message in a direct thread. A product card is how the shop's instant reply shares a piece. */
export type DirectMessage = {
  from: string;
  date: string;
  text: string;
  card?: ProductCard;
};

export type ProductCard = { slug: string; name: string; price: string; note: string };

export type Collection = { name: string; slug: string; codes: string[] };

/**
 * The oracle channel: short texts each page carries in a `text/plain` script
 * (a stand-in for the hydration blob a real single-page app ships) and the
 * client rewrites after every change the server accepts. Final-state facts
 * read these, so a run is judged on what the server holds wherever it ends.
 */
export type PhotoRelay = { consent: string; collections: string; outbox: string; blocked: string };

/**
 * What a run left behind. Everything a visitor can change goes through
 * `mutate` and comes back rendered on every page, so a reload shows it.
 */
export type PhotoState = {
  mode: PhotoMode;
  consent: ConsentChoice;
  notificationsAnswered: boolean;
  dockMinimized: boolean;
  sessionConfirmed: boolean;
  upsellDismissed: boolean;
  /** Codes in "All posts", oldest save first. */
  saved: string[];
  collections: Collection[];
  liked: string[];
  following: string[];
  /** Messages the run sent and the replies they drew, oldest first. */
  messages: Array<DirectMessage & { thread: string }>;
  /** Set once a message arrives with the honeypot filled: the account is action-blocked. */
  blocked: boolean;
  /** Operations the page reported, capped. */
  activity: string[];
  relay: PhotoRelay;
};
