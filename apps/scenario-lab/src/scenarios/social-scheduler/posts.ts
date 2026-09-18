import { connectedAccounts } from "./accounts.js";
import type { QueuedPost, SchedulerMode } from "./types.js";

/** How many posts the workspace has published or lined up. Large enough that the table, not the shell, is the page. */
export const QUEUE_SIZE = 280;

/**
 * The console's fixed "now": Monday 21 September 2026, 09:00 UTC.
 *
 * Every relative label on the page ("In 3 hours", "Yesterday") is measured
 * from here rather than from the wall clock, so a run at any real time reads
 * the same page. The client script is given the same number, which is what
 * lets it place a post the composer schedules at the right point in the queue.
 */
export const REFERENCE_NOW_MS = Date.UTC(2026, 8, 21, 9, 0);

/** Minutes between one post's slot and the next. Ninety keeps a working day to roughly eight slots. */
const SLOT_STEP_MINUTES = 90;
/** The post whose slot is the reference time itself; everything before it has been published or failed. */
const PIVOT_INDEX = 150;

/**
 * Twenty lines of campaign copy, each used fourteen times across the queue.
 *
 * The repetition is the point. A real brand schedules the same copy to several
 * accounts and reschedules it across weeks, so the excerpt in a row is not an
 * identifier: the same sentence appears on fourteen rows, and only the account
 * and the slot tell them apart.
 */
const BODY_LINES = [
  "Autumn trail guide is live: five routes we walk when the larches turn, with parking notes and a rough time for each.",
  "Restock day. The insulated flask everyone asked about is back on the shelf in all three colours.",
  "Weekend forecast looks kind. Reply with where you are heading and we will add it to the map.",
  "New arrivals: the lightweight shell we have been testing since March, now in sizes XS to 3XL.",
  "Repair clinic this Saturday, 10 until 2. Bring a zip, a tear or a tired sole and we will fix what we can.",
  "Ten years of the Harbour Loop cleanup. Two hundred volunteers, four tonnes of litter, one very good dog.",
  "Base layers are half price until Sunday while we make room for the winter range.",
  "How we choose a fabric: a short thread on recycled content, durability and why the two argue with each other.",
  "The shop is shut on Monday for stocktake. Online orders carry on as normal.",
  "Trail notes from the north ridge: the bridge is out at the second crossing, so allow an extra forty minutes.",
  "Meet the makers: a morning with the mill that weaves our merino, and why it still runs the old looms.",
  "Gift cards are back in stock, and yes, they work online and in the shop.",
  "A reminder that our repair service is free for the life of the pack, whoever bought it first.",
  "Sunrise paddle on Thursday. Six places, bring a dry bag, we supply the rest.",
  "Winter boot fitting appointments are open. Half an hour, no charge, and no obligation to buy.",
  "Field test: three stoves, one very windy col, and a kettle that refused to boil for eleven minutes.",
  "We are hiring a weekend workshop assistant. Sewing experience welcome, enthusiasm mandatory.",
  "Packing for a hut trip: the list we actually use, and the three things we always regret bringing.",
  "Second-hand rail restocked this morning with forty pieces traded in over the summer.",
  "Thank you for a record month. Every order this week plants a tree in the valley replanting scheme.",
] as const;

/** Where a post points, without a scheme, as the queue cell shows it. */
const LINK_TARGETS = [
  "northwind.test/trail-guide",
  "northwind.test/restock",
  "northwind.test/new-arrivals",
  "northwind.test/repair-clinic",
  "northwind.test/harbour-loop",
  "northwind.test/winter-range",
  "northwind.test/second-hand",
] as const;

/** Why a post did not go out. Every one of them is something a publishing tool actually reports. */
const FAILURE_REASONS = [
  "The network rejected the post: the token for this account has expired.",
  "The image failed to upload before the slot passed.",
  "The network rate limited this account; the slot passed while waiting.",
  "The post was longer than the network allows.",
] as const;

/**
 * The whole queue under a rendering, in authored order: index 0 is the oldest
 * published post and index 279 the furthest-out scheduled one. The display
 * order is not this order -- `queue.ts` puts the upcoming posts first -- but
 * every derived fact is computed from this list, so the page and the manifest
 * cannot disagree.
 *
 * Only `quiet-week` changes anything: it thins the failures, so the same retry
 * job has a different answer. The lab seed reaches none of it.
 */
export function queuePostsFor(mode: SchedulerMode): readonly QueuedPost[] {
  return Array.from({ length: QUEUE_SIZE }, (_unused, index) => post(index, mode));
}

export function postById(mode: SchedulerMode, id: string): QueuedPost | undefined {
  return queuePostsFor(mode).find((candidate) => candidate.id === id);
}

function post(index: number, mode: SchedulerMode): QueuedPost {
  const offsetMinutes = (index - PIVOT_INDEX) * SLOT_STEP_MINUTES;
  const failed = offsetMinutes < 0 && index % (mode === "quiet-week" ? 47 : 11) === 5;
  const draft = offsetMinutes >= 0 && index % 17 === 3;
  return {
    id: `pst_${identifier(index)}`,
    accountId: cycle(connectedAccounts, index).id,
    body: cycle(BODY_LINES, index),
    link: index % 5 === 2 ? cycle(LINK_TARGETS, index) : "",
    status: offsetMinutes < 0 ? (failed ? "Failed" : "Published") : draft ? "Draft" : "Scheduled",
    offsetMinutes,
    failureReason: failed ? cycle(FAILURE_REASONS, index) : "",
  };
}

/**
 * An opaque six-hex post id, as a real console shows rather than a row number.
 * Knuth's multiplicative constant is odd, so the low 24 bits are a bijection
 * and no two posts can collide.
 */
function identifier(index: number): string {
  return (((index + 23) * 2_654_435_761) % 16_777_216).toString(16).padStart(6, "0");
}

function cycle<TValue>(values: readonly TValue[], index: number): TValue {
  const value = values[index % values.length];
  if (value === undefined) throw new Error("A queue cycle must not be empty");
  return value;
}
