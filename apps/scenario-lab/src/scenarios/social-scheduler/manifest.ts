import { createScenarioManifest } from "../../types.js";
import { accountById, accountCellText } from "./accounts.js";
import { postCellText, scheduledCellText, slotText } from "./format.js";
import { queuePostsFor, QUEUE_SIZE } from "./posts.js";
import { applyChanges, composedPost, filterQueue, orderedQueue, resultCountText, statsText } from "./queue.js";
import { buildMarkerText, SCHEDULER_BUILDS } from "./styles.js";
import type { ComposedPost, QueuedPost, SchedulerMode } from "./types.js";

/** The post the recorded composer workflow schedules, and the account it goes to. */
const COMPOSED: ComposedPost = {
  accountSlug: "photogram-northwind-trails",
  body: "Trail clean-up on Saturday: meet at the Harbour Loop car park at nine, gloves and bags provided.",
  date: "2026-09-24",
  time: "09:00",
};

/** The two accounts the extraction workflows narrow to, by the value their option carries. */
const TRAILS = "photogram-northwind-trails";

const EMPTY_FILTERS = { search: "", account: "", status: "", range: "" };

const BASELINE = orderedQueue(queuePostsFor("baseline"));
const AFTER_COMPOSE = applyChanges(queuePostsFor("baseline"), [], [COMPOSED]);
const WEEK_AHEAD = orderedQueue(filterQueue(queuePostsFor("baseline"), { ...EMPTY_FILTERS, account: TRAILS, range: "next-7" }));

/**
 * Fields inside the composer are addressed by form name: the `id` is generated
 * by the design system, the `name` is the contract. The submit control is the
 * one thing the recording names by test id, which is what `renamed-composer`
 * takes away.
 */
const COMPOSER_BODY = `[data-testid="composer-form"] textarea[name="body"]`;
const COMPOSER_ACCOUNT = `[data-testid="composer-form"] select[name="account"]`;
const COMPOSER_DATE = `[data-testid="composer-form"] input[name="date"]`;
const COMPOSER_TIME = `[data-testid="composer-form"] input[name="time"]`;
/** Only rows, never the empty-state row the table renders when a filter matches nobody. */
const QUEUE_ROWS = `[data-testid="queue-rows"] > tr[data-post-id]`;

/**
 * What a person exporting this queue would read. `column:` follows the header
 * rather than the column position, and each cell's text is what it looks like
 * on a real page: the account's avatar letters, name, network and handle; the
 * truncated post with its link chip; the relative label a person reads with
 * the exact slot underneath it.
 */
const queueFields = {
  account: "column:Account",
  post: "column:Post",
  scheduled: "column:Scheduled",
  status: "column:Status",
};

/** What a retry report holds: which account, which post, and the state it is now in. */
const retryFields = { account: "column:Account", post: "column:Post", status: "column:Status" };

const queueStats = (posts: readonly QueuedPost[]) => ({ id: "queue-stats", subject: "queue-stats", predicate: "text", value: statsText(posts) });
const listed = (posts: readonly QueuedPost[]) => ({ id: "rows-listed", subject: "result-count", predicate: "text", value: resultCountText(posts.length, posts.length) });
const shown = (count: number, total: number) => ({ id: "rows-shown", subject: "result-count", predicate: "text", value: resultCountText(count, total) });
const buildIs = (build: string) => ({ id: "build-marker", subject: "build-marker", predicate: "text", value: buildMarkerText(build) });
const unfiltered = { id: "no-filters", subject: "filter-summary", predicate: "exists", value: false };
const composerClosed = { id: "composer-closed", subject: "composer", predicate: "visible", value: false };
/**
 * Two controls on the page carry the accessible name "Search": the top bar's
 * and the queue filter's. Both are labelled properly and neither can be told
 * from the other by its name alone.
 */
const duplicateSearchLabels = { id: "duplicate-search-labels", subject: "document", predicate: "label-count:Search", value: 2 };

/** The toast the composer leaves behind, which is also the goal's success fact. */
const SCHEDULED_TOAST = {
  id: "scheduled-toast",
  subject: "toast",
  predicate: "text",
  value: `Post scheduled to ${accountById(`acc_${TRAILS}`).handle} for ${slotText(composedPost(COMPOSED, 0).offsetMinutes)}`,
};

/**
 * A social publishing console, at the scale and with the markup of a real one:
 * 280 posts across eight connected accounts, generated class names, a composer
 * the page ships collapsed, one action button per row identical to the other
 * 279, and two accounts that share a display name.
 *
 * Four workflows, and every one of them requires the product to do something.
 * The manifest's own script composes and schedules a post; `retry-failed`
 * narrows the queue to the week's failures, retries them in bulk, and reads
 * back what it retried; `week-ahead` exports one account's coming week;
 * `whole-queue` reads all 280 rows in one go.
 *
 * `recordingEvents` name types without counts on purpose. No recording lane
 * has run this fixture yet, so "this type occurred" is a claim that can be made
 * honestly and an exact tally is not; a count belongs here once a run has
 * produced one.
 */
export const socialSchedulerManifest = createScenarioManifest({
  id: "social-scheduler",
  title: "Social scheduler",
  tags: ["social", "dashboard", "table", "composer", "generated-classes", "bulk-actions", "extraction", "filter"],
  seed: 171,
  startPath: "/scenarios/social-scheduler/",
  capabilities: ["forms", "mutation", "scroll"],
  recordingScript: [
    { id: "open-composer", operation: "click", target: "role:button:New post" },
    { id: "composer-open", operation: "waitForState", target: "testid:composer", timeoutMs: 2000 },
    { id: "write-post", operation: "type", target: COMPOSER_BODY, value: COMPOSED.body },
    { id: "choose-account", operation: "select", target: COMPOSER_ACCOUNT, value: COMPOSED.accountSlug },
    { id: "choose-date", operation: "type", target: COMPOSER_DATE, value: COMPOSED.date },
    { id: "choose-time", operation: "type", target: COMPOSER_TIME, value: COMPOSED.time },
    { id: "schedule-post", operation: "click", target: "testid:composer-submit" },
    { id: "post-queued", operation: "waitForState", target: "testid:toast", timeoutMs: 4000 },
    { id: "post-scheduled", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "schedule-a-post",
    description: "Schedule a post to the Northwind Trails account for the morning of 24 September and confirm it is in the queue.",
    successFacts: [{ ...SCHEDULED_TOAST }, queueStats(AFTER_COMPOSE)],
  },
  expected: {
    pageFacts: [queueStats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels, buildIs(SCHEDULER_BUILDS.baseline)],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }, { type: "web.element.changed" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.select", outcome: "succeeded" },
    ],
    finalState: [{ ...SCHEDULED_TOAST }, queueStats(AFTER_COMPOSE), composerClosed],
    allowedConsoleErrors: [],
  },
  variants: [
    {
      id: "restyled",
      description: "The design system shipped, so every generated class name on the page is a different hash. The markup, the text, the accessible names and the queue are identical, which leaves a recorded class set as the one signal that is now wrong.",
      arm: { operation: "set-mode", payload: { mode: "restyled" } },
      expected: {
        pageFacts: [queueStats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels, buildIs(SCHEDULER_BUILDS.restyled)],
        finalState: [{ ...SCHEDULED_TOAST }, queueStats(AFTER_COMPOSE), composerClosed],
      },
    },
    {
      id: "renamed-composer",
      description: "Only a repair can pass this row. The composer's footer was redesigned: the recorded submit control lost its test id and now reads Add to queue, while Save as draft stands beside it and schedules nothing. A provider-free run fails with target_not_found; the expectations here are the repaired run's, so a model that re-points the click at Add to queue schedules the post, and one that presses Save as draft fails the oracle.",
      arm: { operation: "set-mode", payload: { mode: "renamed-composer" } },
      expected: {
        pageFacts: [
          { id: "recorded-submit-gone", subject: "composer-submit", predicate: "exists", value: false },
          { id: "draft-control-kept", subject: "composer-draft", predicate: "exists", value: true },
          queueStats(BASELINE),
          listed(BASELINE),
        ],
        actions: [
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.select", outcome: "succeeded" },
        ],
        finalState: [{ ...SCHEDULED_TOAST }, queueStats(AFTER_COMPOSE), composerClosed],
      },
    },
  ],
  workflows: [
    {
      id: "retry-failed",
      description: "Narrow the queue to the posts that failed in the last seven days, put every one of them back in the queue, and read back what was retried.",
      recordingScript: [
        { id: "only-failures", operation: "select", target: "testid:status-filter", value: "failed" },
        { id: "only-last-week", operation: "select", target: "testid:range-filter", value: "last-7" },
        { id: "failures-listed", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "select-failures", operation: "check", target: "role:checkbox:Select all posts", value: true },
        { id: "open-retry", operation: "click", target: "role:button:Retry" },
        { id: "retry-asked", operation: "waitForState", target: "testid:confirm-dialog", timeoutMs: 2000 },
        { id: "confirm-retry", operation: "click", target: "role:button:Retry posts" },
        { id: "retry-done", operation: "waitForState", target: "testid:toast", timeoutMs: 4000 },
        { id: "extract-retried", operation: "extract", target: QUEUE_ROWS, fields: retryFields },
        { id: "retried-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [queueStats(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.changed" }, { type: "web.element.clicked" }],
        actions: [
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.check", outcome: "succeeded" },
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.extract_list", outcome: "succeeded" },
        ],
        extracted: [{ step: "extract-retried", count: retriedRows("baseline").length, records: retryRecords("baseline") }],
        finalState: [retryToast("baseline"), queueStats(afterRetry("baseline")), shown(retriedRows("baseline").length, QUEUE_SIZE)],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "quiet-week",
        description: "A calmer week: three posts failed in the last seven days rather than ten, so the same job is correct with a smaller answer and a run that returns the recorded ten has returned somebody else's week.",
        arm: { operation: "set-mode", payload: { mode: "quiet-week" } },
        expected: {
          pageFacts: [queueStats(orderedQueue(queuePostsFor("quiet-week"))), listed(orderedQueue(queuePostsFor("quiet-week")))],
          extracted: [{ step: "extract-retried", count: retriedRows("quiet-week").length, records: retryRecords("quiet-week") }],
          finalState: [retryToast("quiet-week"), queueStats(afterRetry("quiet-week")), shown(retriedRows("quiet-week").length, QUEUE_SIZE)],
        },
      }],
    },
    {
      id: "week-ahead",
      description: "Export the coming week for one account: narrow the queue to Northwind Trails over the next seven days and read every row that is left.",
      recordingScript: [
        { id: "choose-trails", operation: "select", target: "testid:account-filter", value: TRAILS },
        { id: "choose-next-week", operation: "select", target: "testid:range-filter", value: "next-7" },
        { id: "week-listed", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "extract-week-ahead", operation: "extract", target: QUEUE_ROWS, fields: queueFields },
        { id: "week-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [queueStats(BASELINE), listed(BASELINE), unfiltered],
        recordingEvents: [{ type: "web.element.changed" }],
        actions: [{ action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-week-ahead", count: WEEK_AHEAD.length, records: queueRecords(WEEK_AHEAD) }],
        finalState: [shown(WEEK_AHEAD.length, QUEUE_SIZE), queueStats(BASELINE)],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "reordered-columns",
        description: "The queue's columns were reordered, so Status leads and Post sits third. The same rows hold the same text, and a read that follows the header returns the same records; a read that counted cells returns them shuffled.",
        arm: { operation: "set-mode", payload: { mode: "reordered-columns" } },
        expected: {
          pageFacts: [queueStats(BASELINE), listed(BASELINE)],
          extracted: [{ step: "extract-week-ahead", count: WEEK_AHEAD.length, records: queueRecords(WEEK_AHEAD) }],
          finalState: [shown(WEEK_AHEAD.length, QUEUE_SIZE), queueStats(BASELINE)],
        },
      }],
    },
    {
      id: "whole-queue",
      description: "Read the whole publishing queue in one go: all 280 rows, upcoming first and history underneath, with no filter applied.",
      recordingScript: [
        { id: "extract-whole-queue", operation: "extract", target: QUEUE_ROWS, fields: queueFields },
        { id: "whole-queue-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [queueStats(BASELINE), listed(BASELINE), unfiltered],
        actions: [{ action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-whole-queue", count: QUEUE_SIZE, records: queueRecords(BASELINE) }],
        finalState: [listed(BASELINE), queueStats(BASELINE)],
        allowedConsoleErrors: [],
      },
    },
  ],
});

/** The posts a retry puts back in the queue under a rendering, in the order the page then shows them. */
function retriedRows(mode: SchedulerMode): QueuedPost[] {
  const posts = queuePostsFor(mode);
  const failed = filterQueue(posts, { ...EMPTY_FILTERS, status: "failed", range: "last-7" });
  const after = applyChanges(posts, failed.map((post) => post.id), []);
  return orderedQueue(filterQueue(after, { ...EMPTY_FILTERS, status: "queued", range: "last-7" }));
}

/** The whole queue after the retry, which is what the header stats then read. */
function afterRetry(mode: SchedulerMode): QueuedPost[] {
  const posts = queuePostsFor(mode);
  const failed = filterQueue(posts, { ...EMPTY_FILTERS, status: "failed", range: "last-7" });
  return applyChanges(posts, failed.map((post) => post.id), []);
}

function retryToast(mode: SchedulerMode) {
  return { id: "retry-toast", subject: "toast", predicate: "text", value: `${retriedRows(mode).length} posts queued for retry` };
}

/** What `queueFields` reads from each row, in the page's own text. */
function queueRecords(posts: readonly QueuedPost[]): Array<Record<string, string>> {
  return posts.map((post) => ({
    account: accountCellText(accountById(post.accountId)),
    post: postCellText(post),
    scheduled: scheduledCellText(post),
    status: post.status,
  }));
}

/** What `retryFields` reads from each retried row: the same three cells, with the status the retry left behind. */
function retryRecords(mode: SchedulerMode): Array<Record<string, string>> {
  return retriedRows(mode).map((post) => ({
    account: accountCellText(accountById(post.accountId)),
    post: postCellText(post),
    status: post.status,
  }));
}
