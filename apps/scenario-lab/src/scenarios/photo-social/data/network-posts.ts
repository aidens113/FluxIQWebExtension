import type { Post, PostKind } from "../types.js";
import { SHOP } from "./accounts.js";
import { shortcode } from "./shortcode.js";
import { STUDIO_POSTS } from "./studio-posts.js";

type Row = [author: string, date: string, kind: PostKind, slides: number, likes: number | null, caption: string, location: string, subject: string, sponsored?: true];

const COPIED_GIVEAWAY = STUDIO_POSTS[0]!.caption;

/**
 * Everyone else's posts. The impersonator re-posts the studio's giveaway word
 * for word a day later, runs it as an ad, and has its own comments under it;
 * it also has an August post with more likes than anything the studio posted
 * that month. The shop's newest post is the moon jar with no price.
 */
const ROWS: readonly Row[] = [
  [SHOP, "2026-10-01", "carousel", 3, 412, "Speckled moon jar, one of one. 28 cm tall, satin white glaze with iron speckle. DM for price.", "Saltmarsh Goods", "vase"],
  [SHOP, "2026-09-24", "photo", 1, 388, "Speckled mug, \u20ac32. Ships Monday.", "Saltmarsh Goods", "mug"],
  [SHOP, "2026-09-10", "photo", 1, 290, "Small moon jar, sold. Thank you!", "", "vase"],
  [SHOP, "2026-08-28", "photo", 1, 356, "Linen tea towels are back in stock.", "", "textile"],
  [SHOP, "2026-08-02", "photo", 1, 301, "Studio shelves, restocked.", "Saltmarsh Goods", "shelf"],
  ["harbourlight.studios", "2026-09-21", "carousel", 3, 57, COPIED_GIVEAWAY, "Harbourlight Studio, Portmere", "4 cups"],
  ["harbourlight.studios", "2026-09-18", "photo", 1, 12, "Congratulations to our winners! Check your DMs.", "", "text"],
  ["harbourlight.studios", "2026-08-11", "photo", 1, 5020, "Studio day.", "", "pottery"],
  ["harbourlightstudio_official", "2026-09-25", "photo", 1, 31, "Claim your giveaway prize now through the link in our bio.", "", "text"],
  ["harbour.light.studio", "2026-09-21", "photo", 1, 140, "Repost from the studio: the Autumn Kiln Giveaway is on! Enter on their post, not here.", "", "4 cups"],
  ["harbour.light.studio", "2026-08-22", "photo", 1, 96, "Repost: glaze test tiles.", "", "tiles"],
  ["kiln.theory", "2026-09-19", "photo", 1, 2210, "Why your celadon crazes, in one diagram.", "", "diagram"],
  ["kiln.theory", "2026-08-30", "carousel", 2, 1840, "Cone chart, annotated.", "", "chart"],
  ["lena.moss", "2026-09-30", "photo", 1, 88, "Sunday market haul.", "Portmere Market", "market"],
  ["kofi.ade", "2026-09-28", "photo", 1, 142, "First bowl off the wheel!", "", "bowls"],
  ["priya.nair", "2026-09-25", "photo", 1, 64, "Plants in pots in pots.", "", "plants"],
  ["theo.marchetti", "2026-09-23", "photo", 1, 210, "Morning light on the quay.", "Portmere Harbour", "harbour"],
  ["sofia.lindqvist", "2026-09-21", "photo", 1, 97, "Kitchen shelf, finally sorted.", "", "shelf"],
  ["ines.vidal", "2026-09-16", "photo", 1, 51, "Tea and a new mug.", "", "mug"],
  ["maya.hollis", "2026-09-14", "photo", 1, 75, "Coastal walk.", "Saltmarsh Beach", "beach"],
  ["kilnworks.shop", "2026-09-27", "photo", 1, 4410, "Win a Kilnworks studio kiln. Enter now, no purchase necessary.", "", "kiln", true],
  ["harbourlight.studios", "2026-09-21", "carousel", 3, 57, COPIED_GIVEAWAY, "Harbourlight Studio, Portmere", "4 cups", true],
  ["glazelab.supply", "2026-09-22", "photo", 1, 1320, "Twelve new celadons. Free shipping this week.", "", "bottles", true],
];

export const NETWORK_POSTS: readonly Post[] = ROWS.map(([author, date, kind, slides, likes, caption, location, subject, sponsored]) => ({
  code: shortcode(`${author}:${date}:${sponsored === true ? "ad" : "post"}`),
  author,
  date,
  kind,
  slides,
  likes,
  plays: 0,
  caption,
  location,
  subject,
  pinned: false,
  sponsored: sponsored === true,
}));

/** The shop's newest post, whose piece carries no price. */
export const MOON_JAR_POST: Post = NETWORK_POSTS[0]!;

/** The impersonator's word-for-word copy of the giveaway, which has comments of its own. */
export const COPIED_GIVEAWAY_POST: Post = NETWORK_POSTS[5]!;
