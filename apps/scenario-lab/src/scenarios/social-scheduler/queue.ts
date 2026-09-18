import { accountById, accountBySlug, accountCellText } from "./accounts.js";
import { REFERENCE_NOW_MS } from "./posts.js";
import { STATUS_OPTIONS, type QueueOption } from "./options.js";
import type { ComposedPost, QueueFilters, QueuedPost } from "./types.js";

const MINUTES_PER_WEEK = 10_080;
const SLOT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * The order the queue is shown in: everything still to go out, soonest first,
 * then everything that has already gone out, most recent first. That is what a
 * publishing queue with its history underneath looks like, and it is why the
 * authored order in `posts.ts` is not the display order.
 */
export function orderedQueue(posts: readonly QueuedPost[]): QueuedPost[] {
  const upcoming = posts.filter((post) => post.offsetMinutes >= 0).sort((left, right) => left.offsetMinutes - right.offsetMinutes);
  const gone = posts.filter((post) => post.offsetMinutes < 0).sort((left, right) => right.offsetMinutes - left.offsetMinutes);
  return [...upcoming, ...gone];
}

/**
 * The queue after the run's own changes: a retried post is back in the queue
 * as `Queued`, and every post the composer scheduled is in the list. Used for
 * the page and for the oracle, so the two cannot disagree.
 */
export function applyChanges(posts: readonly QueuedPost[], retried: readonly string[], composed: readonly ComposedPost[]): QueuedPost[] {
  const queued = new Set(retried);
  const existing = posts.map((post) => (queued.has(post.id) ? { ...post, status: "Queued" as const, failureReason: "" } : post));
  return [...existing, ...composed.map((entry, index) => composedPost(entry, index))];
}

/**
 * One post the composer scheduled, as a row of the queue. The slot is parsed
 * strictly: a date or time the composer could not have produced throws rather
 * than becoming a post at the reference time.
 */
export function composedPost(composed: ComposedPost, index: number): QueuedPost {
  const date = SLOT_PATTERN.exec(composed.date);
  const time = TIME_PATTERN.exec(composed.time);
  if (!date || !time) throw new Error(`A composed post needs a YYYY-MM-DD date and an HH:MM time, not ${composed.date} ${composed.time}`);
  const account = accountBySlug(composed.accountSlug);
  if (!account) throw new Error(`No connected account ${composed.accountSlug}`);
  const at = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), Number(time[1]), Number(time[2]));
  return {
    id: `pst_new${String(index + 1).padStart(3, "0")}`,
    accountId: account.id,
    body: composed.body,
    link: "",
    status: "Scheduled",
    offsetMinutes: Math.round((at - REFERENCE_NOW_MS) / 60_000),
    failureReason: "",
  };
}

/**
 * The rows the toolbar leaves showing. Search matches the post's full text or
 * the account cell as the page shows it; the three selects each match one
 * property exactly. An empty value is "any", as each select's first option is.
 *
 * The search reads the account *cell*, not the account record, because that is
 * what the page's own script can see once it is rendered, and the two must
 * agree or a filtered run and a filtered expectation would disagree.
 */
export function filterQueue(posts: readonly QueuedPost[], filters: QueueFilters): QueuedPost[] {
  const needle = filters.search.trim().toLowerCase();
  const status = labelFor(STATUS_OPTIONS, filters.status);
  return posts.filter((post) => {
    const owner = accountById(post.accountId);
    const matchesSearch = needle === ""
      || post.body.toLowerCase().includes(needle)
      || accountCellText(owner).toLowerCase().includes(needle);
    return matchesSearch
      && (filters.account === "" || owner.slug === filters.account)
      && (status === undefined || post.status === status)
      && inRange(post, filters.range);
  });
}

/** Whether a payload the page sent is a post the composer could have produced. */
export function isComposedPost(value: unknown): value is ComposedPost {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.body === "string" && candidate.body.trim() !== ""
    && typeof candidate.accountSlug === "string" && accountBySlug(candidate.accountSlug) !== undefined
    && typeof candidate.date === "string" && SLOT_PATTERN.test(candidate.date)
    && typeof candidate.time === "string" && TIME_PATTERN.test(candidate.time);
}

/** What the page header counts: the whole queue, what is still lined up, and what did not go out. */
export function queueCounts(posts: readonly QueuedPost[]): { postCount: number; scheduledCount: number; failedCount: number } {
  return {
    postCount: posts.length,
    scheduledCount: posts.filter((post) => post.status === "Scheduled").length,
    failedCount: posts.filter((post) => post.status === "Failed").length,
  };
}

/** The header stat line, which is also the oracle a final-state fact reads. */
export function statsText(posts: readonly QueuedPost[]): string {
  const { postCount, scheduledCount, failedCount } = queueCounts(posts);
  return `${postCount} posts · ${scheduledCount} scheduled · ${failedCount} failed`;
}

export function resultCountText(shown: number, total: number): string {
  return `Showing ${shown} of ${total} posts`;
}

/**
 * Whether a post falls inside a named date range, measured from the console's
 * fixed reference time. A range the select does not offer is "any time", which
 * is the only value the page itself can produce for it.
 */
function inRange(post: QueuedPost, range: string): boolean {
  if (range === "next-7") return post.offsetMinutes >= 0 && post.offsetMinutes < MINUTES_PER_WEEK;
  if (range === "upcoming") return post.offsetMinutes >= 0;
  if (range === "last-7") return post.offsetMinutes < 0 && post.offsetMinutes > -MINUTES_PER_WEEK;
  if (range === "past") return post.offsetMinutes < 0;
  return true;
}

/** The label of a chosen option, or `undefined` for "any" and for a value no option offers. */
function labelFor(options: readonly QueueOption[], value: string): string | undefined {
  if (value === "") return undefined;
  return options.find((option) => option.value === value)?.label;
}
