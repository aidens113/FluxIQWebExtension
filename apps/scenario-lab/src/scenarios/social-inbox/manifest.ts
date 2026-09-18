import { createScenarioManifest } from "../../types.js";
import { inboxAccountById, inboxAccountCellText } from "./accounts.js";
import { conversationsFor, INBOX_PAGE_SIZE, INBOX_SIZE, REPLY_TARGET } from "./conversations.js";
import { ageText, authorCellText } from "./format.js";
import { applyInboxChanges, filterConversations, inboxStatsText, inboxStatusText, pageOf } from "./inbox.js";
import { inboxBuildMarkerText, INBOX_BUILDS } from "./styles.js";
import type { Conversation, InboxMode } from "./types.js";

/** What the recorded reply says. Nothing in the fixture reads it back except the conversation's own page. */
const REPLY_TEXT = "Thank you, Priya. I will pass that on to the team who were on bar that morning.";

/**
 * The account whose backlog the extraction workflow reads. One of the three
 * that are all called "Harbor & Pine" and all answer to `@harborandpine`, so
 * choosing it means reading past the name to the network.
 */
const BACKLOG_ACCOUNT = "chirp-harborandpine";

const EMPTY_FILTERS = { search: "", account: "", kind: "", status: "", age: "" };

const BASELINE = conversationsFor("baseline");
const FIRST_SCREEN = pageOf(BASELINE, 1).items;
const AFTER_REPLY = applyInboxChanges(BASELINE, { replies: [{ id: REPLY_TARGET.id, text: REPLY_TEXT }], handled: [], assigned: [] });

/**
 * The row's Reply control, addressed the only way it can be: by the row it is
 * in. Every Reply on a screen of twenty-five rows has the same tag, the same
 * generated class and the same accessible name. The reply dialog's own fields
 * are addressed by form name, because the `id` is generated and the `name` is
 * the contract; its submit control is the one thing the recording names by
 * test id, which is what `moved-send` takes away.
 */
const ROW_REPLY = `[data-conversation-id="${REPLY_TARGET.id}"] button[aria-haspopup="dialog"]`;
const REPLY_TEXTAREA = `[data-testid="reply-dialog"] textarea[name="reply"]`;
/** Only conversations, never the empty-state row the table renders when a filter matches nothing. */
const INBOX_ROWS = `[data-testid="inbox-rows"] > tr[data-conversation-id]`;

/**
 * What a person triaging this inbox would read. `column:` follows the header
 * rather than the column position, and each cell's text is what it looks like
 * on a real page: the writer's avatar letters, name and handle; the account's
 * name, network and handle; and the terse age an inbox shows instead of a
 * date.
 */
const backlogFields = { from: "column:From", account: "column:Account", kind: "column:Kind", age: "column:Age" };
const screenFields = { ...backlogFields, status: "column:Status" };
/**
 * A conversation's own page is a record rather than a list, so its parts are
 * named, the way `product-catalog`'s product page names them. The inbox list
 * itself labels nothing: a read of it has to follow the headers a person sees.
 */
const detailFields = {
  from: "testid:detail-from",
  account: "testid:detail-account",
  kind: "testid:detail-kind",
  status: "testid:detail-status",
  message: "testid:detail-message",
};

const inboxStats = (conversations: readonly Conversation[]) => ({ id: "inbox-stats", subject: "inbox-stats", predicate: "text", value: inboxStatsText(conversations) });
const showing = (shown: number, matched: number) => ({ id: "inbox-showing", subject: "inbox-status", predicate: "text", value: inboxStatusText(shown, matched) });
const buildIs = (build: string) => ({ id: "build-marker", subject: "build-marker", predicate: "text", value: inboxBuildMarkerText(build) });
const unfiltered = { id: "no-filters", subject: "filter-summary", predicate: "exists", value: false };
const nothingOlder = { id: "nothing-older", subject: "load-older", predicate: "exists", value: false };
const moreToLoad = { id: "more-to-load", subject: "load-older", predicate: "visible", value: true };
const dialogClosed = { id: "reply-dialog-closed", subject: "reply-dialog", predicate: "visible", value: false };
/**
 * Two controls on the page carry the accessible name "Search": the top bar's
 * and the inbox filter's. Both are labelled properly and neither can be told
 * from the other by its name alone.
 */
const duplicateSearchLabels = { id: "duplicate-search-labels", subject: "document", predicate: "label-count:Search", value: 2 };

/** The toast the reply leaves behind, which is also the goal's success fact. */
const REPLY_TOAST = {
  id: "reply-toast",
  subject: "toast",
  predicate: "text",
  value: `Replied to ${REPLY_TARGET.author.name}. The conversation is now marked handled.`,
};

/**
 * A social inbox at the scale and with the markup of a real one: 320
 * conversations across six watched accounts, three of which are called "Harbor
 * & Pine" and all answer to the same handle; generated class names; twenty-five
 * rows on screen with the rest behind a control that loads older ones; and
 * three action controls on every row identical to the three on every other.
 *
 * Four workflows, and every one of them requires the product to do something.
 * The manifest's own script finds one person among 320 conversations, narrows
 * to their single mention, answers it and leaves it handled;
 * `unanswered-backlog` triages one account's week-old backlog across two
 * loaded pages; `first-screen` reads what the inbox opens with;
 * `open-conversation` follows a row through to the conversation's own page and
 * reads it there.
 *
 * `recordingEvents` name types without counts on purpose. No recording lane
 * has run this fixture yet, so "this type occurred" is a claim that can be made
 * honestly and an exact tally is not; a count belongs here once a run has
 * produced one.
 */
export const socialInboxManifest = createScenarioManifest({
  id: "social-inbox",
  title: "Social inbox",
  tags: ["social", "inbox", "table", "lazy-load", "generated-classes", "bulk-actions", "extraction", "filter"],
  seed: 172,
  startPath: "/scenarios/social-inbox/",
  capabilities: ["forms", "mutation", "scroll", "navigation"],
  recordingScript: [
    { id: "find-writer", operation: "type", target: "testid:inbox-search", value: REPLY_TARGET.author.name },
    { id: "writer-listed", operation: "waitForState", target: "testid:chip-search", timeoutMs: 3000 },
    { id: "mentions-only", operation: "select", target: "testid:kind-filter", value: "mention" },
    { id: "one-mention-left", operation: "waitForState", target: "testid:chip-kind", timeoutMs: 3000 },
    { id: "open-reply", operation: "click", target: ROW_REPLY },
    { id: "reply-open", operation: "waitForState", target: "testid:reply-dialog", timeoutMs: 3000 },
    { id: "write-reply", operation: "type", target: REPLY_TEXTAREA, value: REPLY_TEXT },
    { id: "send-reply", operation: "click", target: "testid:reply-submit" },
    { id: "reply-sent", operation: "waitForState", target: "testid:toast", timeoutMs: 4000 },
    { id: "conversation-handled", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "answer-a-mention",
    description: `Reply to the mention from ${REPLY_TARGET.author.name} and make sure the conversation ends up marked as handled.`,
    successFacts: [{ ...REPLY_TOAST }, inboxStats(AFTER_REPLY)],
  },
  expected: {
    pageFacts: [inboxStats(BASELINE), showing(INBOX_PAGE_SIZE, INBOX_SIZE), unfiltered, duplicateSearchLabels, buildIs(INBOX_BUILDS.baseline), moreToLoad],
    recordingEvents: [{ type: "web.element.input_changed" }, { type: "web.element.changed" }, { type: "web.element.clicked" }],
    actions: [
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.select", outcome: "succeeded" },
      { action: "web.dom.click", outcome: "succeeded" },
    ],
    finalState: [{ ...REPLY_TOAST }, inboxStats(AFTER_REPLY), dialogClosed],
    allowedConsoleErrors: [],
  },
  variants: [
    {
      id: "restyled",
      description: "The design system shipped, so every generated class name on the page is a different hash. The markup, the text, the accessible names and the conversations are identical, which leaves a recorded class set as the one signal that is now wrong.",
      arm: { operation: "set-mode", payload: { mode: "restyled" } },
      expected: {
        pageFacts: [inboxStats(BASELINE), showing(INBOX_PAGE_SIZE, INBOX_SIZE), unfiltered, duplicateSearchLabels, buildIs(INBOX_BUILDS.restyled)],
        finalState: [{ ...REPLY_TOAST }, inboxStats(AFTER_REPLY), dialogClosed],
      },
    },
    {
      id: "moved-send",
      description: "Only a repair can pass this row. The reply dialog was redesigned: Send moved out of the footer into the dialog's header and lost its test id, and Discard now stands where the recorded control was. A provider-free run fails with target_not_found; the expectations here are the repaired run's, so a model that re-points the click at Send answers the mention, and one that presses Discard sends nothing and fails the oracle.",
      arm: { operation: "set-mode", payload: { mode: "moved-send" } },
      expected: {
        pageFacts: [
          { id: "recorded-send-gone", subject: "reply-submit", predicate: "exists", value: false },
          inboxStats(BASELINE),
          showing(INBOX_PAGE_SIZE, INBOX_SIZE),
          unfiltered,
        ],
        actions: [
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.click", outcome: "succeeded" },
        ],
        finalState: [{ ...REPLY_TOAST }, inboxStats(AFTER_REPLY), dialogClosed],
      },
    },
  ],
  workflows: [
    {
      id: "unanswered-backlog",
      description: "Triage one account's backlog: narrow the inbox to what is still unanswered and more than three days old on the Chirp Harbor & Pine account, load everything older, and read it all.",
      recordingScript: [
        { id: "pick-account", operation: "select", target: "testid:account-filter", value: BACKLOG_ACCOUNT },
        { id: "account-chosen", operation: "waitForState", target: "testid:chip-account", timeoutMs: 3000 },
        { id: "only-unanswered", operation: "select", target: "testid:status-filter", value: "unanswered" },
        { id: "unanswered-chosen", operation: "waitForState", target: "testid:chip-status", timeoutMs: 3000 },
        { id: "older-than-three-days", operation: "select", target: "testid:age-filter", value: "over-3d" },
        { id: "age-chosen", operation: "waitForState", target: "testid:chip-age", timeoutMs: 3000 },
        {
          id: "extract-backlog", operation: "extract", target: INBOX_ROWS, fields: backlogFields,
          pagination: { mode: "loadMore", control: "testid:load-older", maxPages: 15 },
        },
        { id: "backlog-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [inboxStats(BASELINE), showing(INBOX_PAGE_SIZE, INBOX_SIZE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.changed" }],
        actions: [{ action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{
          step: "extract-backlog",
          count: backlog("baseline").length,
          records: conversationRecords(backlog("baseline"), false),
          pages: pagesFor(backlog("baseline").length),
        }],
        finalState: [showing(backlog("baseline").length, backlog("baseline").length), nothingOlder, inboxStats(BASELINE)],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "quiet-inbox",
        description: "A quieter week: everything older than a week that was still unanswered has since been dealt with, so the same backlog fits on one screen and the control that loads older conversations never appears. A run that returns the recorded twenty-eight has returned last week's backlog.",
        arm: { operation: "set-mode", payload: { mode: "quiet-inbox" } },
        expected: {
          pageFacts: [inboxStats(conversationsFor("quiet-inbox")), showing(INBOX_PAGE_SIZE, INBOX_SIZE)],
          extracted: [{
            step: "extract-backlog",
            count: backlog("quiet-inbox").length,
            records: conversationRecords(backlog("quiet-inbox"), false),
            pages: pagesFor(backlog("quiet-inbox").length),
          }],
          finalState: [showing(backlog("quiet-inbox").length, backlog("quiet-inbox").length), nothingOlder, inboxStats(conversationsFor("quiet-inbox"))],
        },
      }],
    },
    {
      id: "first-screen",
      description: "Read what the inbox opens with: the twenty-five newest conversations, with no filter and nothing loaded beyond the first screen.",
      recordingScript: [
        { id: "extract-first-screen", operation: "extract", target: INBOX_ROWS, fields: screenFields },
        { id: "first-screen-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [inboxStats(BASELINE), showing(INBOX_PAGE_SIZE, INBOX_SIZE), unfiltered, moreToLoad],
        actions: [{ action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-first-screen", count: INBOX_PAGE_SIZE, records: conversationRecords(FIRST_SCREEN, true) }],
        finalState: [showing(INBOX_PAGE_SIZE, INBOX_SIZE), inboxStats(BASELINE)],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "open-conversation",
      description: `Follow one conversation through: find ${REPLY_TARGET.author.name} among the 320, narrow to their mention, open it, and read the whole thing on its own page.`,
      recordingScript: [
        { id: "find-mention-writer", operation: "type", target: "testid:inbox-search", value: REPLY_TARGET.author.name },
        { id: "writer-found", operation: "waitForState", target: "testid:chip-search", timeoutMs: 3000 },
        { id: "narrow-to-mention", operation: "select", target: "testid:kind-filter", value: "mention" },
        { id: "mention-alone", operation: "waitForState", target: "testid:chip-kind", timeoutMs: 3000 },
        { id: "open-the-conversation", operation: "click", target: `role:link:${REPLY_TARGET.author.name}` },
        { id: "extract-conversation", operation: "extract", target: "testid:conversation-detail", fields: detailFields },
        { id: "conversation-read", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [inboxStats(BASELINE), showing(INBOX_PAGE_SIZE, INBOX_SIZE), unfiltered],
        recordingEvents: [{ type: "web.element.input_changed" }, { type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
        extracted: [{ step: "extract-conversation", count: 1, records: [detailRecord()] }],
        finalState: [
          { id: "on-the-conversation", subject: "detail-heading", predicate: "text", value: REPLY_TARGET.author.name },
          { id: "message-in-full", subject: "detail-message", predicate: "text", value: REPLY_TARGET.message },
        ],
        allowedConsoleErrors: [],
      },
    },
  ],
});

/** One account's unanswered backlog older than three days, under a rendering, in the order the inbox shows it. */
function backlog(mode: InboxMode): Conversation[] {
  return filterConversations(conversationsFor(mode), { ...EMPTY_FILTERS, account: BACKLOG_ACCOUNT, status: "unanswered", age: "over-3d" });
}

/** How many pages a read of that many conversations covers, the first included. */
function pagesFor(matched: number): number {
  return Math.max(1, Math.ceil(matched / INBOX_PAGE_SIZE));
}

/** What `backlogFields` (and, with the status, `screenFields`) reads from each row, in the page's own text. */
function conversationRecords(conversations: readonly Conversation[], withStatus: boolean): Array<Record<string, string>> {
  return conversations.map((conversation) => {
    const record: Record<string, string> = {
      from: authorCellText(conversation.author),
      account: inboxAccountCellText(inboxAccountById(conversation.accountId)),
      kind: conversation.kind,
      age: ageText(conversation.ageMinutes),
    };
    if (withStatus) record.status = conversation.status;
    return record;
  });
}

/** What `detailFields` reads on the conversation's own page. */
function detailRecord(): Record<string, string> {
  const account = inboxAccountById(REPLY_TARGET.accountId);
  return {
    from: `${REPLY_TARGET.author.name} ${REPLY_TARGET.author.handle}`,
    account: inboxAccountCellText(account),
    kind: REPLY_TARGET.kind,
    status: REPLY_TARGET.status,
    message: REPLY_TARGET.message,
  };
}
