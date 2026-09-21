import type { Audience } from "../types.js";

/** What a post carries beneath its text. A link opens in a new tab through the site's outbound-link shim. */
export type Attachment =
  | { kind: "photo"; alt: string; hue: number }
  | { kind: "link"; title: string; domain: string; url: string }
  | { kind: "video"; title: string };

/**
 * One post as the feed shows it. `reactions`, `comments` and `shares` are the
 * page's own words ("1.2K", "Tom Becker and 23 others", "14 comments"); a post
 * nobody reacted to shows no reaction line at all, which is why each is
 * optional rather than zero.
 */
export type FeedPost = {
  kind: "post";
  id: string;
  author: string;
  group?: string;
  minutesAgo: number;
  audience: Audience;
  text: string;
  reactions?: string;
  comments?: string;
  shares?: string;
  attachment?: Attachment;
  /** Maya's own post, which is running as a paid boost and so cannot be edited. */
  boosted?: true;
};

/** A friend passing on someone else's post, with a line of their own above it. */
export type SharedUnit = { kind: "shared"; id: string; sharer: string; minutesAgo: number; caption: string; page: string; originalMinutesAgo: number; originalText: string; reactions?: string; comments?: string };
/** An advert. It reads like a post, carries no timestamp, and its "Sponsored" label is not plain text. */
export type SponsoredUnit = { kind: "sponsored"; id: string; page: string; text: string; headline: string; domain: string; cta: string };
/** A post from a group or page Maya does not follow, which the feed puts in front of her anyway. */
export type SuggestedUnit = { kind: "suggested"; id: string; community: string; author?: string; minutesAgo: number; text: string; reactions?: string; comments?: string };
/** A post the feed shows a second time because friends have since commented on it. */
export type RecapUnit = { kind: "recap"; id: string; context: string; of: string };
export type CarouselUnit = { kind: "people" | "reels"; id: string };
/** One of Maya's own posts from years ago, offered back to her to share again. */
export type MemoryUnit = { kind: "memory"; id: string; yearsAgo: number; text: string };

export type FeedUnit = FeedPost | SharedUnit | SponsoredUnit | SuggestedUnit | RecapUnit | CarouselUnit | MemoryUnit;

const ELENA_COMMITTEE = "Notes from Saturday's committee meeting, for anyone who couldn't make it. The water troughs will be switched off from 1 November, so please drain your hoses and store them in your shed rather than leaving them on the paths. The skip for green waste is booked for the weekend of 10 October; woody prunings only, no soil, no plastic pots. Plot inspections move to the first Sunday of each month, and the waiting list is now down to eleven names. Thank you to everyone who helped repaint the gate!";
const HANNAH_TEN_K = "Twelve weeks ago I couldn't run for a bus. This morning I finished my first 10K in 58:41, which is not fast, but I didn't stop once and I didn't cry until the very end. Huge thanks to the Harbourside Runners Tuesday group for dragging me round the park in the dark all summer, and to Dev for the pep talk at the 8K sign. Next stop: the Riverside half in March, apparently. Someone please remind me I said this.";
const OLIVER_MILK_BREAD = "Finally cracked the tangzhong method for the milk bread everyone kept asking about. The trick for me was cooking the roux to 65°C rather than going by look, then letting it cool completely before it goes into the dough. I've written up the full recipe with weights, timings and a few photos of the shaping, and I'll bring a couple of loaves to the stall on Saturday so you can see the crumb for yourselves. Oven temperatures are for a fan oven; add 20 degrees for conventional.";
const ELENA_RECYCLING = "A small public service announcement from someone who has now been caught out twice: the recycling collection on the east side of the river has moved from Thursday to Friday, starting this week, and the brown bins go every other week rather than weekly from October until the end of March. The council's calendar on the website still shows the old days, which is how I ended up dragging two bins back up the hill this morning. Pass it on!";

/** Maya's open-day post. It is boosted, so the site will not let it be edited, only deleted and posted again. */
export const OPEN_DAY_POST: FeedPost = {
  kind: "post", id: "p_0d3a91", author: "maya-lindqvist", minutesAgo: 1_190, audience: "Public",
  text: "Open day at Riverside Allotments on Saturday 26 September, 10:00 to 15:00! Seed swap, jam tasting and plot tours, everyone welcome. Find us at plot 14.",
  reactions: "Aisha Khan and 36 others", comments: "9 comments", shares: "4 shares", boosted: true,
};

/**
 * The home feed down to "You're all caught up", in the order it loads, five
 * units to a batch. Sixteen of the thirty are posts friends wrote themselves;
 * the rest are what a real feed puts between them -- three adverts and a
 * repeat of one, two suggestions, two friends passing on a page's post, Maya's
 * own boosted post, a memory, two carousels, and two posts shown a second time
 * because friends have since commented on them.
 */
export const FEED_BEFORE_CAUGHT_UP: readonly FeedUnit[] = [
  post("p_4b2a10", "aisha-khan", 62, "Friends", "First proper frost on the allotment this morning. Dahlias are done for the year, so the tubers are coming up this weekend. Anyone want some 'Café au Lait' divisions?", { reactions: "Tom Becker and 23 others", comments: "6 comments", attachment: { kind: "photo", alt: "May be an image of flower and nature", hue: 330 } }),
  { kind: "sponsored", id: "s_7f0c21", page: "greenleaf-seeds", text: "Autumn sowing sale: 30% off broad beans, garlic and overwintering onions until Sunday. Free delivery on orders over £25.", headline: "Sow now, harvest in spring", domain: "GREENLEAFSEEDS.EXAMPLE", cta: "Shop now" },
  post("p_7c1e44", "elena-sokolova", 185, "Members", ELENA_COMMITTEE, { group: "riverside-allotments", reactions: "41", comments: "18 comments" }),
  OPEN_DAY_POST,
  post("p_9b3302", "marcus-reid", 247, "Public", "Harbourside Council has confirmed the Quay Street bridge will close for repairs from 5 October for up to six weeks. Buses 12 and 12A will divert via Mill Lane. Full details and the diversion map in the link.", { reactions: "1.2K", comments: "212 comments", shares: "388 shares", attachment: { kind: "link", title: "Quay Street bridge to close for six weeks of repairs", domain: "HARBOURSIDEPOST.EXAMPLE", url: "https://harbourside-post.example/news/quay-street-bridge" } }),

  { kind: "people", id: "c_pymk01" },
  post("p_2d80f5", "hannah-okafor", 368, "Friends", HANNAH_TEN_K, { reactions: "Aisha Khan and 9 others", comments: "3 comments" }),
  { kind: "shared", id: "h_b71d09", sharer: "tom-becker", minutesAgo: 421, caption: "Worth knowing if you drive in on the Quay Street side.", page: "harbourside-council", originalMinutesAgo: 902, originalText: "From Monday 5 October, Quay Street bridge will be closed to all traffic while essential repairs are carried out. Pedestrians can still cross on the temporary walkway.", reactions: "7", comments: "2 comments" },
  { kind: "suggested", id: "g_3a5e17", community: "urban-growers", author: "kim-tran", minutesAgo: 520, text: "Does anyone have a reliable way to keep pigeons off brassicas that isn't netting? Mine get through everything.", reactions: "56", comments: "73 comments" },
  post("p_5e1f38", "dev-patel", 512, "Public", "The drone footage from Sunday's coastal run came out better than I expected. Turn the sound up for the waves at the end.", { reactions: "57", attachment: { kind: "video", title: "Coastal run, Sunday morning" } }),

  { kind: "sponsored", id: "s_2e9a40", page: "brightside-energy", text: "Heat pumps from £0 upfront with the government grant. Check if your home qualifies in two minutes.", headline: "Is your home heat pump ready?", domain: "BRIGHTSIDEENERGY.EXAMPLE", cta: "Get quote" },
  post("p_c4a90b", "sofia-marin", 734, "Members", "Tuesday's session is moving to the leisure centre track while the park lights are being replaced. Same time, 18:30. Bring a head torch for the warm-down lap.", { group: "harbourside-runners", reactions: "88", comments: "24 comments" }),
  post("p_31b7d6", "lukas-brandt", 1_207, "Friends", "Does anyone know a plumber who actually answers the phone? Asking for a friend. The friend is my kitchen ceiling.", {}),
  { kind: "reels", id: "c_reels1" },
  { kind: "recap", id: "r_6c20e8", context: "Aisha Khan commented on this.", of: "p_7c1e44" },

  post("p_e6021c", "grace-liu", 1_496, "Public", "Thirty-one candles, one smoke alarm. Thank you all for the birthday messages, I read every one of them (eventually).", { reactions: "Hannah Okafor and 61 others", comments: "31 comments", attachment: { kind: "photo", alt: "May be an image of cake and indoor", hue: 40 } }),
  { kind: "memory", id: "m_5y0914", yearsAgo: 5, text: "Our first harvest from plot 14! Four courgettes and a very confused pumpkin." },
  post("p_0a5d77", "oliver-hughes", 1_765, "Members", OLIVER_MILK_BREAD, { group: "old-town-bakers", reactions: "74", comments: "15 comments" }),
  { kind: "sponsored", id: "s_91d3b6", page: "tidewater-outdoor", text: "Waterproof, windproof, weekend-proof. The Coastline jacket is back in five colours.", headline: "Coastline Jacket", domain: "TIDEWATEROUTDOOR.EXAMPLE", cta: "Shop now" },
  post("p_8f1420", "nadia-rahman", 2_890, "Public", "Six years ago today I opened the doors of a tiny café with two tables and a borrowed espresso machine. Today we're moving into the old post office on Market Street. I can't quite believe it. Thank you, Harbourside.", { reactions: "3.4K", comments: "1.1K comments", shares: "96 shares" }),

  post("p_b2c8e1", "ben-carter", 3_021, "Friends", "Lost: one grey cat, answers to Biscuit, last seen near Chapel Row wearing a disapproving expression. Found: same cat, asleep in my own airing cupboard, four hours later.", { reactions: "12", comments: "1 comment" }),
  { kind: "suggested", id: "g_d40f52", community: "kettle-and-crumb", minutesAgo: 1_880, text: "New on the counter this week: brown butter and sage scones. Only while the sage lasts.", reactions: "230", comments: "18 comments" },
  post("p_6d2e5a", "tom-becker", 4_330, "Members", "Has anyone seen the green wheelbarrow from the shared shed? It was there on Wednesday. No questions asked, just please bring it back before the manure delivery.", { group: "riverside-allotments", reactions: "9", comments: "7 comments" }),
  { kind: "shared", id: "h_4c1a7e", sharer: "sofia-marin", minutesAgo: 4_510, caption: "Entries are open! Who's in?", page: "riverside-half", originalMinutesAgo: 5_020, originalText: "General entry for the 2027 Riverside Half is now open. Early-bird pricing ends 31 October.", reactions: "15", comments: "6 comments" },
  post("p_d9e033", "elena-sokolova", 5_690, "Public", ELENA_RECYCLING, { reactions: "Marcus Reid and 132 others", comments: "47 comments", shares: "58 shares" }),

  { kind: "sponsored", id: "s_c0e5f8", page: "greenleaf-seeds", text: "Garlic for planting: 12 varieties, hand-graded, dispatched this week.", headline: "Autumn garlic collection", domain: "GREENLEAFSEEDS.EXAMPLE", cta: "Learn more" },
  post("p_1f7b92", "tom-becker", 7_255, "Friends", "New to me, old to everyone else. 1983 Raleigh, rebuilt over the summer.", { reactions: "19", attachment: { kind: "photo", alt: "May be an image of 1 person, bicycle and outdoors", hue: 150 } }),
  { kind: "recap", id: "r_e81b37", context: "Grace Liu and Dev Patel commented on this.", of: "p_8f1420" },
  post("p_4e8c19", "dev-patel", 8_410, "Members", "Found at the park after Thursday's session: one blue glove, left hand, and a car key with a red fob. Both are with me until someone claims them.", { group: "harbourside-runners", reactions: "23", comments: "2 comments" }),
  post("p_a71d6f", "aisha-khan", 8_840, "Public", "Jam update: 14 jars of damson, 9 of hedgerow, and one of something I'm calling 'experimental'. Stall at the open day, all proceeds to the allotment society's water fund.", { reactions: "You and 17 others", comments: "5 comments" }),
];

/** What the feed keeps offering once Maya is caught up: nothing she follows, all of it suggested or paid for. */
export const FEED_AFTER_CAUGHT_UP: readonly FeedUnit[] = [
  { kind: "suggested", id: "g_7e2b90", community: "cycle-commuters", author: "rosa-delgado", minutesAgo: 300, text: "Petition for a protected cycle lane on Mill Lane is at 2,400 signatures. Link in the comments.", reactions: "412", comments: "96 comments" },
  { kind: "sponsored", id: "s_5b8d13", page: "brightside-energy", text: "Solar panels and a battery, installed in a day. Book a free survey this month.", headline: "Make your own electricity", domain: "BRIGHTSIDEENERGY.EXAMPLE", cta: "Book now" },
  { kind: "suggested", id: "g_19c6d4", community: "urban-growers", author: "idris-bello", minutesAgo: 1_400, text: "Seed swap at the library, Saturday 3 October, 11:00 to 14:00. Bring labelled envelopes!", reactions: "88", comments: "12 comments" },
  { kind: "suggested", id: "g_a3f761", community: "kettle-and-crumb", minutesAgo: 3_100, text: "We're hiring a weekend baker. Early starts, good coffee, and all the misshapen croissants you can eat.", reactions: "154", comments: "40 comments" },
];

/** How many units the `quiet-feed` rendering shows before it is caught up: the first three batches. */
export const QUIET_FEED_UNITS = 15;

function post(id: string, author: string, minutesAgo: number, audience: Audience, text: string, extra: Partial<Pick<FeedPost, "group" | "reactions" | "comments" | "shares" | "attachment">>): FeedPost {
  return { kind: "post", id, author, minutesAgo, audience, text, ...extra };
}
