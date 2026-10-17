import type { LiveInstructionTask } from "../live-instructions.js";

const GLAZE_IDEAS = "Create a collection in my saved posts called Glaze ideas that holds exactly the three most-liked posts the verified Harbourlight Studio account published in August 2026, and leave my other collections as they are.";

const GIVEAWAY_ENTRIES = "Harbourlight Studio, the verified pottery account, is running an Autumn Kiln Giveaway on one of its posts. Work out every valid entry under the rules the studio pinned in that post's comments, and give me one row per person with columns entrant, comment and date: entrant is the person's username, comment is the text of the comment that counts as their entry exactly as written, and date is the day that comment was posted, as YYYY-MM-DD. List the rows in the order those comments appear under the post once every comment and reply has been loaded.";

const MOON_JAR_PRICE = "Saltmarsh Goods has posted a speckled moon jar without saying what it costs. Find out what they are asking for it and give me a one-row table with columns item and price, with the piece's name and its price exactly as the shop gives them.";

const PRIYA_TAGS = "Priya Nair (@priya.nair) wants to know who tagged her under the Autumn Kiln Giveaway post from Harbourlight Studio, the verified pottery account. Find every comment and reply on that post that tags @priya.nair, and give me one row per comment with columns author, comment and date: author is the username of whoever wrote it, comment is its text exactly as written, and date is the day it was posted, as YYYY-MM-DD. List the rows in the order they appear under the post once every comment and reply has been loaded.";

const NEWEST_LIKES = "Like the three most recent posts the verified Harbourlight Studio account has published, and do not like, save, follow or message anything else. Then give me a table of the posts you liked, newest first, with one column, link, holding each post's address.";

const AUGUST_OVER_1300 = "Did the verified Harbourlight Studio account get more than 1,300 likes on any post it published in August 2026? Give me every such post as a table with columns date and likes, where date is the day it was posted as YYYY-MM-DD and likes is the exact number of likes the post shows. If none did, an empty table is the right answer.";

const KILN_NOTES = "In my saved posts, make a new collection called Kiln Theory notes that holds every post from the Kiln Theory account I have already saved, and nothing else. Don't unsave anything or change my other collections. Then show me all of my collections, leaving out All posts, as a table with columns collection and posts, where posts is how many posts each one holds, in the order my Saved page lists them.";

/**
 * Framelight's creation tasks, one per kind of job the site is for.
 *
 * - The collection is the state-changing job, judged by final state: the
 *   instruction asks for the collection, so creating it is instructed.
 * - The giveaway is the extraction job, judged by its dataset: the rules have
 *   to be read off the post and applied across forty comments and a reply.
 *   Its `verified-upsell` twin is the same job on a site that has since grown
 *   a subscription upsell, for the existing-Flow entry point: the Flow is
 *   built on the site without the upsell (`variantArmedAfterBuild`) and meets
 *   it only when it runs, as the variant describes.
 * - The moon jar is the consequential job. The only way to the price is to
 *   message the shop, and the instruction does not ask for a message to be
 *   sent, so without permission for `send_or_publish` the right outcome is a
 *   permission request; with one, the dataset judges it.
 *
 * The breadth tasks (`breadth/`), one per kind of job:
 *
 * - `priya-tags` reads across every comment batch and the replies, keeping
 *   only what tags one person, and is judged record by record.
 * - `newest-likes` is a lasting act judged by the whole account: the grid's
 *   pinned posts come before the newest, so liking the first cells is wrong.
 * - `august-over-1300` is the conditional whose right answer is an empty
 *   table; the reel's play count, the 2025 pinned post, the impersonator and
 *   Kiln Theory each give a wrong row.
 * - `kiln-notes` is the longer journey: the Saved page, the new-collection
 *   form and its picker, then the collections read back.
 */
export const PHOTO_SOCIAL_LIVE_TASKS: readonly LiveInstructionTask[] = [
  { id: "photo-social-glaze-collection", scenarioId: "photo-social", kind: "form", instruction: GLAZE_IDEAS, judgeBy: "playback-goal" },
  { id: "photo-social-giveaway-entries", scenarioId: "photo-social", kind: "navigate-and-extract", instruction: GIVEAWAY_ENTRIES, judgeBy: "expected-dataset", expectedDatasetId: "extract-giveaway-entries" },
  { id: "photo-social-giveaway-entries-verified-upsell", scenarioId: "photo-social", variantId: "verified-upsell", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: GIVEAWAY_ENTRIES, judgeBy: "expected-dataset", expectedDatasetId: "extract-giveaway-entries" },
  { id: "photo-social-moon-jar-price", scenarioId: "photo-social", kind: "navigate-and-extract", instruction: MOON_JAR_PRICE, judgeBy: "expected-dataset", expectedDatasetId: "extract-moon-jar-price", permissionPoint: { consequence: "send_or_publish", control: "Send" } },
  {"id":"photo-social-extend-studio-inspo","scenarioId":"photo-social","kind":"navigate-and-extract","instruction":"Make sure my existing Studio inspo collection contains the three most-liked posts from the verified Harbourlight Studio account in August 2026. Keep everything that is already in Studio inspo and every other collection, do not create a new collection or unsave any post, and do not like, follow or message anyone. Show a one-row table with columns collection and posts naming Studio inspo and its final number of posts.","judgeBy":"expected-dataset","expectedDatasetId":"extract-studio-inspo"},
  { id: "photo-social-priya-tags", scenarioId: "photo-social", kind: "navigate-and-extract", instruction: PRIYA_TAGS, judgeBy: "expected-dataset", expectedDatasetId: "extract-priya-tags" },
  { id: "photo-social-newest-likes", scenarioId: "photo-social", kind: "navigate-and-extract", instruction: NEWEST_LIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-newest-likes" },
  { id: "photo-social-august-over-1300", scenarioId: "photo-social", kind: "navigate-and-extract", instruction: AUGUST_OVER_1300, judgeBy: "expected-dataset", expectedDatasetId: "extract-august-over-1300" },
  { id: "photo-social-kiln-notes", scenarioId: "photo-social", kind: "form", instruction: KILN_NOTES, judgeBy: "expected-dataset", expectedDatasetId: "extract-kiln-notes" },
];
