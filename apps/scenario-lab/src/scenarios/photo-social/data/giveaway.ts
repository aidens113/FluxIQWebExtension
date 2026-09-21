import type { Comment } from "../types.js";
import { STUDIO } from "./accounts.js";
import { commentId } from "./shortcode.js";

type Row = [author: string, date: string, text: string, likes?: number, replies?: ReadonlyArray<[author: string, date: string, text: string]>];

/**
 * The rules, as the studio pinned them. Entries are judged on comments alone:
 * two friends tagged in one comment or reply, one entry per person counted at
 * their first qualifying comment, the studio and the commenter never counting
 * as friends, and nothing after 27 September.
 */
export const GIVEAWAY_RULES = "How to enter: tag two friends in a comment on this post (replies count too). One entry per person, and only your first qualifying comment counts. Tagging us, or yourself, does not count as a friend. Entries close 27 September at 23:59. Winners are only ever announced from this account, and we will never ask you to pay or to click a link.";

/** The last day a comment can qualify on. */
export const GIVEAWAY_CLOSES = "2026-09-27";

/**
 * Every comment under the giveaway, newest first, which is the order the post
 * shows them in beneath the pinned rules. Replies are collapsed until opened
 * and listed oldest first under their comment.
 *
 * What is in here is what a real giveaway thread holds: people entering more
 * than once, tagging the same friend twice, tagging themselves or the studio,
 * entering after the close, and two accounts impersonating the studio to claim
 * winners. One person's only qualifying entry is a reply to her own comment.
 */
const ROWS: readonly Row[] = [
  ["harbourlightstudio_official", "2026-10-03", "Congratulations! You have been selected as one of our winners. Claim your prize through the link in our bio", 2],
  ["noor.haddad", "2026-10-02", "Did anyone win? @lena.moss"],
  [STUDIO, "2026-09-30", "The winner has been drawn and messaged from this account. Thank you all for entering!", 41],
  ["felix.ortega", "2026-09-29", "Is it too late to enter? @grace.adeyemi @luca.bianchi"],
  ["zara.qureshi", "2026-09-28", "@milo.frank @ava.kowalski fingers crossed", 1],
  ["dara.oconnell", "2026-09-28", "@nell.pryce @omar.farouk \u{1F91E}"],
  ["sam.rivera", "2026-09-27", "Last minute entry! @yuki.tanaka @dara.oconnell", 3],
  ["lena.moss", "2026-09-27", "@kofi.ade @ines.vidal one more for luck"],
  ["harbourlight.studios", "2026-09-26", "@sam.rivera you have won! Send us a DM to claim"],
  ["omar.farouk", "2026-09-26", "@clara.voss @ben.achebe @nell.pryce \u{1F64C}", 2],
  ["grace.adeyemi", "2026-09-26", "@iris.nakamura @tomas.reid second try!"],
  ["hana.sato", "2026-09-25", "@hana.sato @eli.park"],
  ["eli.park", "2026-09-25", "Would love these! @hana.sato @harbourlight.studio", 1],
  ["milo.frank", "2026-09-25", "Where do you sell these?", 0, [[STUDIO, "2026-09-25", "@milo.frank at our seconds sales and through the shop link in our bio!"]]],
  ["theo.marchetti", "2026-09-24", "@sofia.lindqvist @ravi.menon these would look great on our shelf", 4],
  ["aiyana.cole", "2026-09-24", "Beautiful work \u{1F60D}", 2, [[STUDIO, "2026-09-24", "@aiyana.cole thank you so much!"]]],
  ["kofi.ade", "2026-09-23", "@lena.moss @lena.moss"],
  ["priya.nair", "2026-09-23", "@jonah.west @maya.hollis", 5, [["jonah.west", "2026-09-23", "@priya.nair thanks for the tag!"], ["maya.hollis", "2026-09-24", "@priya.nair \u{1F64F}"]]],
  ["ines.vidal", "2026-09-22", "Entering! @maya.hollis", 1, [["ines.vidal", "2026-09-22", "@ines.vidal forgot one: @maya.hollis @jonah.west"]]],
  ["grace.adeyemi", "2026-09-22", "@luca.bianchi @felix.ortega @zara.qureshi", 2],
  ["yuki.tanaka", "2026-09-22", "The speckle on these \u{1F60D}"],
  ["oskar.brandt", "2026-09-21", "@kiln.theory @noor.haddad", 1],
  ["lena.moss", "2026-09-21", "So pretty @kofi.ade @priya.nair", 6],
  ["kiln.theory", "2026-09-21", "Gorgeous glaze on these", 12],
  ["ava.kowalski", "2026-09-21", "@harbourlight.studio @ava.kowalski @milo.frank"],
  ["clara.voss", "2026-09-21", "@ben.achebe and @iris.nakamura, look!", 2],
  ["maya.hollis", "2026-09-20", "@priya.nair @ines.vidal", 3],
  ["jonah.west", "2026-09-20", "@priya.nair"],
  ["sofia.lindqvist", "2026-09-20", "First! @theo.marchetti @ravi.menon", 8],
  ["ravi.menon", "2026-09-20", "Entered \u{1F642} @sofia.lindqvist"],
  ["tomas.reid", "2026-09-20", "@noor.haddad @noor.haddad @noor.haddad"],
  ["iris.nakamura", "2026-09-20", "@clara.voss @ben.achebe", 1],
  ["nell.pryce", "2026-09-20", "Love these \u{1F60D} @omar.farouk"],
  ["ben.achebe", "2026-09-20", "@clara.voss @iris.nakamura count me in", 2],
  ["luca.bianchi", "2026-09-20", "Such a lovely giveaway"],
  ["zara.qureshi", "2026-09-20", "Beautiful \u{1F60D}"],
  ["felix.ortega", "2026-09-20", "Gorgeous"],
  ["eli.park", "2026-09-20", "Do you ship to Canada? @harbourlight.studio", 0, [[STUDIO, "2026-09-20", "@eli.park we do!"]]],
  ["sam.rivera", "2026-09-20", "Beautiful set"],
  ["dara.oconnell", "2026-09-20", "\u{1F60D}\u{1F60D}\u{1F60D}"],
];

function build(label: string, rows: readonly Row[]): Comment[] {
  return rows.map(([author, date, text, likes, replies], index) => ({
    id: commentId(`${label}:${index}`),
    author,
    date,
    text,
    likes: likes ?? 0,
    pinned: false,
    replies: (replies ?? []).map(([replyAuthor, replyDate, replyText], replyIndex) => ({
      id: commentId(`${label}:${index}:${replyIndex}`),
      author: replyAuthor,
      date: replyDate,
      text: replyText,
      likes: 0,
      pinned: false,
      replies: [],
    })),
  }));
}

/** The pinned rules, shown above every other comment. */
export const GIVEAWAY_PINNED: Comment = { id: commentId("giveaway:pinned"), author: STUDIO, date: "2026-09-20", text: GIVEAWAY_RULES, likes: 214, pinned: true, replies: [] };

export const GIVEAWAY_COMMENTS: readonly Comment[] = build("giveaway", ROWS);

/**
 * The impersonator's copy has an entry list of its own, from different
 * people, so a run that reads the wrong post returns a plausible wrong answer.
 */
export const COPIED_GIVEAWAY_COMMENTS: readonly Comment[] = build("copied-giveaway", [
  ["harbourlight.studios", "2026-09-26", "Winners have been contacted by DM! Check your requests"],
  ["milo.frank", "2026-09-24", "@ava.kowalski @luca.bianchi"],
  ["hana.sato", "2026-09-23", "@eli.park @yuki.tanaka"],
  ["tomas.reid", "2026-09-22", "@noor.haddad @felix.ortega"],
  ["zara.qureshi", "2026-09-22", "@milo.frank @dara.oconnell"],
  ["nell.pryce", "2026-09-21", "@omar.farouk @clara.voss"],
  ["aiyana.cole", "2026-09-21", "Is this the real one?"],
]);
