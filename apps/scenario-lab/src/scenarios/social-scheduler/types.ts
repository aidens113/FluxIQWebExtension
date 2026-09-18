/**
 * The publishing console's vocabulary: a connected account, a post in the
 * queue, what the toolbar can narrow the queue by, and the renderings the
 * fixture can be armed into.
 *
 * `baseline` is the console as it ships. The four armed renderings are each
 * one thing a real deployment does between a recording and a run:
 *
 * - `restyled` -- the CSS-in-JS build hash moved, so every generated class
 *   name on the page is different and nothing else is.
 * - `renamed-composer` -- the composer footer was redesigned: the recorded
 *   submit control lost its test id and is now labelled "Add to queue", with a
 *   "Save as draft" control beside it that schedules nothing. Only a repair
 *   that re-points the click at the right one of the two passes this.
 * - `reordered-columns` -- the queue's columns were reordered, so a read that
 *   follows the header survives and a read that counts cells does not.
 * - `quiet-week` -- a calmer week: three posts failed in the last seven days
 *   rather than ten, so the same retry job has a different answer.
 */
export const schedulerModes = ["baseline", "restyled", "renamed-composer", "reordered-columns", "quiet-week"] as const;

export type SchedulerMode = (typeof schedulerModes)[number];

/**
 * Every state a post in the queue can be in, as the badge spells it.
 * `Queued` is reachable only by retrying a failed post, which is what makes a
 * table of queued posts evidence that the retry actually ran.
 */
export const postStatuses = ["Scheduled", "Draft", "Published", "Failed", "Queued"] as const;

export type PostStatus = (typeof postStatuses)[number];

/** What one post may hold, shown under the composer's text area as a shipped composer shows it. */
export const POST_LIMIT = 280;

/** One connected account. Two of them share a display name and differ only by network and handle. */
export type ConnectedAccount = {
  id: string;
  /** The account's handle, including its leading "@". */
  handle: string;
  /** The network the account posts to, as the account cell spells it. */
  network: string;
  display: string;
  /** The avatar's letters, which are text in the cell like everything else. */
  initials: string;
  /** The toolbar select's option value for this account. */
  slug: string;
};

/** One row of the queue. `offsetMinutes` is signed against the console's fixed reference time. */
export type QueuedPost = {
  id: string;
  accountId: string;
  /** What the post says in full; the queue cell shows a truncated excerpt of it. */
  body: string;
  /** The link the post carries, without a scheme, or an empty string for a post with none. */
  link: string;
  status: PostStatus;
  offsetMinutes: number;
  /** Why publishing failed, or an empty string for a post that did not fail. */
  failureReason: string;
};

/** What the toolbar is asking for. Empty strings are "any", as the selects' first options are. */
export type QueueFilters = { search: string; account: string; status: string; range: string };

/** A post the run composed and scheduled, in the order the composer sent it. */
export type ComposedPost = { accountSlug: string; body: string; date: string; time: string };

/**
 * What the run left behind. `composed` and `retried` are the changes the page
 * reported through `mutate`; `oracle` is the queue those changes produce, so a
 * run's final state can be checked without replaying the page's arithmetic.
 */
export type SchedulerState = {
  mode: SchedulerMode;
  composed: ComposedPost[];
  /** Ids of posts a retry put back into the queue, oldest first. */
  retried: string[];
  /** Ids of post pages opened through the `route` hook, oldest first, capped. */
  postViews: string[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
  oracle: { postCount: number; scheduledCount: number; failedCount: number };
};
