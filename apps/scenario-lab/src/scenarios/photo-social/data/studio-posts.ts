import type { Post, PostKind } from "../types.js";
import { STUDIO } from "./accounts.js";
import { shortcode } from "./shortcode.js";

type Row = [date: string, kind: PostKind, slides: number, likes: number | null, plays: number, caption: string, location: string, subject: string, pinned?: true];

const STUDIO_HOME = "Harbourlight Studio, Portmere";

/**
 * The studio's grid, pinned posts first and then newest first, which is the
 * order the profile shows it in. Forty-five posts, so the grid is four
 * screens and a session check deep.
 *
 * Three things are laid in on purpose, and every one of them is what the real
 * site does:
 *
 * - The second pinned post is from August **2025**, and it out-likes every
 *   post of August 2026.
 * - Four August 2026 posts sit between 1,207 and 1,249 likes. The grid's hover
 *   count shows all four as "1.2K"; only a post's own page tells them apart.
 * - The August reel shows its play count on the grid, 18.3K, which is not its
 *   like count, 640.
 */
const ROWS: readonly Row[] = [
  ["2026-09-20", "carousel", 3, 2987, 0, "Autumn Kiln Giveaway! We're giving away a set of four speckled tumblers from our last firing. To enter, tag two friends in a comment below. Full rules are pinned in the comments. Good luck!", STUDIO_HOME, "4 cups", true],
  ["2025-08-14", "photo", 1, 3412, 0, "Five years ago today we fired our first kiln load in a borrowed shed. Thank you for every mug, bowl and kind word since.", "Portmere Harbour", "pottery", true],
  ["2026-03-02", "photo", 1, 1570, 0, "Spring workshop dates are live: six Saturdays of throwing, trimming and glazing. Link in bio.", STUDIO_HOME, "text", true],
  ["2026-10-02", "photo", 1, 842, 0, "Seconds sale this Saturday from ten. Slightly wonky, entirely usable.", STUDIO_HOME, "tableware"],
  ["2026-09-29", "reel", 1, 1105, 21480, "Trimming a foot ring, start to finish.", "", "pottery wheel"],
  ["2026-09-26", "photo", 1, 933, 0, "Test tiles for the winter range. Which blue?", STUDIO_HOME, "tiles"],
  ["2026-09-24", "carousel", 2, 1012, 0, "Unloading the kiln after a 1260 degree firing.", "", "kiln"],
  ["2026-09-22", "photo", 1, 776, 0, "Rainy day in the studio.", "Portmere", "window"],
  ["2026-09-17", "photo", 1, null, 0, "A new clay body arrived and it is very, very speckled.", "", "clay"],
  ["2026-09-15", "photo", 1, 698, 0, "Handles, handles, handles.", STUDIO_HOME, "mugs"],
  ["2026-09-12", "carousel", 4, 1320, 0, "Open studio weekend recap. Thank you to everyone who came by.", STUDIO_HOME, "people"],
  ["2026-09-09", "photo", 1, 654, 0, "Wax resist on the new plates.", "", "plates"],
  ["2026-09-06", "reel", 1, 890, 15730, "Pulling a handle in real time.", "", "pottery wheel"],
  ["2026-09-03", "photo", 1, 731, 0, "Our kiln shelf, after twelve firings.", "", "shelf"],
  ["2026-09-01", "photo", 1, 802, 0, "September means soup bowls.", STUDIO_HOME, "bowls"],
  ["2026-08-30", "photo", 1, 1207, 0, "Tea bowl trials in three glazes.", STUDIO_HOME, "bowls"],
  ["2026-08-27", "carousel", 3, 874, 0, "Kiln unloading, as promised.", "", "kiln"],
  ["2026-08-24", "reel", 1, 640, 18312, "Throwing a moon jar in sixty seconds.", "", "pottery wheel"],
  ["2026-08-21", "photo", 1, 1249, 0, "Glaze test tiles: celadon, tenmoku, shino and one happy accident.", STUDIO_HOME, "tiles"],
  ["2026-08-18", "photo", 1, 1121, 0, "Studio dog, supervising.", STUDIO_HOME, "dog"],
  ["2026-08-15", "carousel", 2, 956, 0, "The speckled clay body, fired and unfired.", "", "clay"],
  ["2026-08-12", "photo", 1, 1030, 0, "Workshop recap: twelve first bowls, all of them keepers.", STUDIO_HOME, "people"],
  ["2026-08-09", "photo", 1, 1236, 0, "A slow celadon pour.", STUDIO_HOME, "vase"],
  ["2026-08-06", "photo", 1, 702, 0, "Pit-fired pieces from the beach firing.", "Saltmarsh Beach", "pottery"],
  ["2026-08-03", "photo", 1, 1212, 0, "Ash glaze on porcelain, straight out of the kiln.", STUDIO_HOME, "vase"],
  ["2026-07-31", "photo", 1, 1260, 0, "Last day of July and the kiln is finally cool enough to open.", STUDIO_HOME, "kiln"],
  ["2026-07-28", "photo", 1, 688, 0, "Bisque ware waiting its turn.", "", "pottery"],
  ["2026-07-25", "carousel", 3, 912, 0, "Summer market stall, all day Saturday.", "Portmere Market", "market"],
  ["2026-07-22", "photo", 1, 540, 0, "Reclaiming clay is nobody's favourite job.", "", "clay"],
  ["2026-07-19", "reel", 1, 1034, 22010, "Centering, slowed down.", "", "pottery wheel"],
  ["2026-07-16", "photo", 1, 766, 0, "Shino, again.", STUDIO_HOME, "cups"],
  ["2026-07-13", "photo", 1, 601, 0, "New shelves for the finished work.", "", "shelf"],
  ["2026-07-10", "photo", 1, 845, 0, "A jug for a wedding.", "", "jug"],
  ["2026-07-07", "photo", 1, 579, 0, "Wedging.", "", "clay"],
  ["2026-07-04", "photo", 1, 998, 0, "Planters for the courtyard.", STUDIO_HOME, "plants"],
  ["2026-06-30", "photo", 1, 720, 0, "End of term for the evening class.", STUDIO_HOME, "people"],
  ["2026-06-27", "carousel", 2, 811, 0, "Tenmoku test, two ways.", "", "bowls"],
  ["2026-06-24", "photo", 1, 505, 0, "Kiln wash day.", "", "kiln"],
  ["2026-06-21", "photo", 1, 1188, 0, "Longest day, longest firing.", STUDIO_HOME, "kiln"],
  ["2026-06-18", "photo", 1, 632, 0, "Stamps for the studio mark.", "", "stamps"],
  ["2026-06-15", "reel", 1, 944, 16400, "Glazing by dipping, one breath per bowl.", "", "bowls"],
  ["2026-06-12", "photo", 1, 587, 0, "Clay delivery.", "", "clay"],
  ["2026-06-09", "photo", 1, 700, 0, "Our first oval baking dish.", "", "dish"],
  ["2026-06-06", "photo", 1, 655, 0, "Sgraffito tests.", "", "tiles"],
  ["2026-06-03", "photo", 1, 874, 0, "June's first firing.", STUDIO_HOME, "kiln"],
];

export const STUDIO_POSTS: readonly Post[] = ROWS.map(([date, kind, slides, likes, plays, caption, location, subject, pinned]) => ({
  code: shortcode(`${STUDIO}:${date}`),
  author: STUDIO,
  date,
  kind,
  slides,
  likes,
  plays,
  caption,
  location,
  subject,
  pinned: pinned === true,
  sponsored: false,
}));

/** The giveaway, which is also the first pinned post. */
export const GIVEAWAY_POST: Post = STUDIO_POSTS[0]!;
