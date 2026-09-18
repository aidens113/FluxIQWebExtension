import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { inboxAccountCellText, inboxAccounts } from "../accounts.js";
import { conversationsFor, INBOX_PAGE_SIZE, INBOX_SIZE, INBOX_TEAM, REFERENCE_NOW_MS, REPLY_TARGET } from "../conversations.js";
import { ageText, messageExcerpt, receivedText } from "../format.js";
import { applyInboxChanges, filterConversations, inboxCounts, inboxStatsText, pageOf } from "../inbox.js";
import { socialInboxScenario as scenario } from "../scenario.js";
import { INBOX_BUILDS, inboxClasses } from "../styles.js";
import type { InboxMode, InboxState } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "social-inbox-unit-token", seed: 172 };
const baselineCss = inboxClasses(INBOX_BUILDS.baseline);
const restyledCss = inboxClasses(INBOX_BUILDS.restyled);
const BACKLOG_ACCOUNT = "chirp-harborandpine";
const EMPTY_FILTERS = { search: "", account: "", kind: "", status: "", age: "" };

const apply = (state: InboxState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const armed = (mode: InboxMode) => apply(scenario.createState(scenario.seed), "set-mode", { mode });
const render = (mode: InboxMode) => scenario.render(armed(mode), context);
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;
/** The document without the page's own script, which quotes selectors and class names that are not markup. */
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;
const request = (subpath: string, query: Record<string, string> = {}) => ({ subpath, query: new URLSearchParams(query), method: "GET" as const });

/** The primary workflow and every `workflows[]` entry, each bare and under each of its variants. */
function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

/** One cell's text as a reader would take it: tags removed, entities restored, whitespace collapsed. */
function cellText(fragment: string): string {
  return fragment
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&#039;", "'")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

/** The header texts of the rendered inbox table, in order. */
function headersOf(html: string): string[] {
  const markup = markupOf(html);
  const head = markup.slice(markup.indexOf("<thead"), markup.indexOf("</thead>"));
  return [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gu)].map((match) => cellText(match[1] ?? ""));
}

/** One array of cell texts per conversation row in a rows fragment or a whole page. */
function rowsOf(html: string): string[][] {
  return [...html.matchAll(/<tr class="[^"]*" data-conversation-id="[\s\S]*?<\/tr>/gu)]
    .map((match) => [...match[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map((cell) => cellText(cell[1] ?? "")));
}

/** What a `column:<header>` read of those rows yields for the named columns. */
function readColumns(headers: readonly string[], rows: readonly string[][], columns: readonly string[]): Array<Record<string, string>> {
  const indexes = columns.map((column) => {
    const index = headers.indexOf(column);
    assert.notEqual(index, -1, `the table has no ${column} column`);
    return [column.toLowerCase(), index] as const;
  });
  return rows.map((cells) => Object.fromEntries(indexes.map(([column, index]) => [column, cells[index] ?? ""])));
}

test("the manifest is a valid scenario with four workflows and three variants, each arming one mode", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["unanswered-backlog", "first-screen", "open-conversation"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [
      { id: "restyled", arm: { operation: "set-mode", payload: { mode: "restyled" } } },
      { id: "moved-send", arm: { operation: "set-mode", payload: { mode: "moved-send" } } },
    ],
    [{ id: "quiet-inbox", arm: { operation: "set-mode", payload: { mode: "quiet-inbox" } } }],
    [],
    [],
  ]);
  assert.equal(selections().length, 7);
  for (const selection of selections()) {
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
    assert.equal(expected.failure, undefined, `${label(selection)} must be judged on succeeding, never on a refusal`);
  }
});

test("every rendering declares its own page facts and inherits none", () => {
  for (const selection of selections()) {
    const { atLoad, afterArm } = scenarioPageFactSchedule(manifest, selection, "arms-after-loading");
    assert.ok(atLoad.length > 0, `${label(selection)} unarmed facts`);
    if (selection.variantId === undefined) assert.deepEqual(afterArm, [], label(selection));
    else assert.ok(afterArm.length > 0, `${label(selection)} armed facts`);
  }
});

test("the inbox is 320 authored conversations on a fixed clock, identical for every seed", () => {
  const conversations = conversationsFor("baseline");
  assert.equal(conversations.length, INBOX_SIZE);
  assert.equal(new Set(conversations.map(({ id }) => id)).size, INBOX_SIZE);
  assert.deepEqual(conversationsFor("baseline"), conversationsFor("baseline"));
  assert.deepEqual(scenario.createState(1), scenario.createState(999));
  assert.equal(inboxStatsText(conversations), "320 conversations · 187 unanswered · 16 assigned");
  assert.equal(new Date(REFERENCE_NOW_MS).toISOString(), "2026-09-21T09:00:00.000Z");
  assert.equal(receivedText(0), "Mon 21 Sep 2026, 09:00");
  assert.deepEqual([ageText(25), ageText(90), ageText(4_320), ageText(20_160)], ["25m", "1h", "3d", "2w"]);
  // Ages grow faster than linearly, as a real inbox's do: busy in the last day, sparse at the back.
  assert.ok(conversations[0]!.ageMinutes < 60 && conversations[INBOX_SIZE - 1]!.ageMinutes > 40 * 1_440);
});

test("every watched account has conversations in every state, so no account's backlog is empty by accident", () => {
  for (const account of inboxAccounts) {
    const mine = filterConversations(conversationsFor("baseline"), { ...EMPTY_FILTERS, account: account.slug });
    const states = new Set(mine.map(({ status }) => status));
    assert.ok(mine.length > 40, `${account.slug} holds only ${mine.length} conversations`);
    assert.deepEqual([...states].sort(), ["Assigned", "Handled", "Unanswered"], account.slug);
  }
});

test("three accounts share a display name and a handle, and differ only by network", () => {
  const sameName = inboxAccounts.filter(({ display }) => display === "Harbor & Pine");
  assert.equal(sameName.length, 3);
  assert.equal(new Set(sameName.map(({ handle }) => handle)).size, 1, "the three must also share a handle");
  assert.equal(new Set(sameName.map(({ network }) => network)).size, 3);
  assert.equal(new Set(sameName.map((account) => inboxAccountCellText(account))).size, 3, "the cell must still tell them apart");
  assert.equal(new Set(inboxAccounts.map(({ slug }) => slug)).size, inboxAccounts.length);
});

test("the recorded reply answers a person who wrote several times but mentioned the workspace once", () => {
  const all = conversationsFor("baseline");
  const theirs = all.filter(({ author }) => author.handle === REPLY_TARGET.author.handle);
  assert.ok(theirs.length >= 3, "the person must have written more than once, or narrowing is not a question");
  assert.equal(theirs.filter(({ kind }) => kind === "Mention").length, 1);
  assert.equal(REPLY_TARGET.status, "Unanswered");
  // Not on the first screen, so the run has to search rather than read what is in front of it.
  assert.ok(all.findIndex(({ id }) => id === REPLY_TARGET.id) >= INBOX_PAGE_SIZE);
  const byName = filterConversations(all, { ...EMPTY_FILTERS, search: REPLY_TARGET.author.name });
  assert.deepEqual(byName.map(({ id }) => id).sort(), theirs.map(({ id }) => id).sort());
  const oneMention = filterConversations(all, { ...EMPTY_FILTERS, search: REPLY_TARGET.author.name, kind: "mention" });
  assert.deepEqual(oneMention.map(({ id }) => id), [REPLY_TARGET.id]);
});

test("the page opens on twenty-five rows with identical row controls, two controls named Search, and a closed reply dialog", () => {
  const markup = markupOf(render("baseline"));
  assert.equal(occurrences(markup, "data-conversation-id=\""), INBOX_PAGE_SIZE);
  assert.equal(occurrences(markup, ">Reply</button>"), INBOX_PAGE_SIZE);
  assert.equal(occurrences(markup, ">Mark handled</button>"), INBOX_PAGE_SIZE);
  assert.equal(occurrences(markup, ">Search</label>"), 2);
  assert.equal(occurrences(markup, "data-testid=\"load-older\""), 1);
  assert.match(markup, /data-testid="reply-scrim" hidden/u);
  assert.equal(occurrences(markup, "data-testid=\"reply-submit\""), 1);
  assert.deepEqual(headersOf(render("baseline")), ["", "From", "Account", "Kind", "Age", "Status", "Assigned", "Message", "Actions"]);
  assert.ok(!markup.includes("data-testid=\"detail-"), "the list must not label its own fields for a reader");
});

test("a row shows a truncated message and keeps the whole one where a person can still reach it", () => {
  const markup = markupOf(render("baseline"));
  const excerpts = conversationsFor("baseline").map(({ message }) => messageExcerpt(message));
  assert.ok(excerpts.some((excerpt) => excerpt.endsWith("…")), "no message is long enough to be cut");
  for (const excerpt of excerpts) assert.ok(excerpt.length <= 73, excerpt);
  const first = pageOf(conversationsFor("baseline"), 1).items[0]!;
  assert.ok(markup.includes(`title="${first.message.replaceAll("&", "&amp;")}"`), "the whole message must stay in the row's title");
});

test("restyling changes every class name and nothing a person reads", () => {
  const baseline = markupOf(render("baseline"));
  const restyled = markupOf(render("restyled"));
  assert.notEqual(baselineCss.row, restyledCss.row);
  assert.equal(occurrences(restyled, baselineCss.row), 0);
  assert.deepEqual(rowsOf(baseline), rowsOf(restyled));
});

test("the recorded send control is the one thing moved-send takes away, and Discard stands where it was", () => {
  const baseline = markupOf(render("baseline"));
  const moved = markupOf(render("moved-send"));
  assert.ok(baseline.includes("data-testid=\"reply-submit\"") && !baseline.includes("data-testid=\"reply-send\""));
  assert.ok(!moved.includes("data-testid=\"reply-submit\""), "the recorded control must be gone");
  assert.ok(moved.includes("data-testid=\"reply-send\"") && moved.includes(">Send</button>"));
  assert.ok(moved.includes("data-testid=\"reply-discard\""), "the wrong answer must be pressable");
  assert.ok(!baseline.includes("data-testid=\"reply-discard\""));
  assert.deepEqual(rowsOf(baseline), rowsOf(moved));
});

test("the first-screen dataset is what a column read of the rendered page returns", () => {
  const declared = manifest.workflows?.find(({ id }) => id === "first-screen")?.expected.extracted?.[0];
  assert.equal(declared?.count, INBOX_PAGE_SIZE);
  const page = render("baseline");
  assert.deepEqual(readColumns(headersOf(page), rowsOf(markupOf(page)), ["From", "Account", "Kind", "Age", "Status"]), declared.records);
});

test("the backlog dataset is what the two loaded pages of rows actually say", () => {
  const declared = manifest.workflows?.find(({ id }) => id === "unanswered-backlog")?.expected.extracted?.[0];
  assert.equal(declared?.count, 28);
  assert.equal(declared.pages, 2);
  const query = { account: BACKLOG_ACCOUNT, status: "unanswered", age: "over-3d" };
  const state = scenario.createState(scenario.seed);
  const first = scenario.route?.(state, request("items", { ...query, page: "1" }), context);
  const second = scenario.route?.(state, request("items", { ...query, page: "2" }), context);
  assert.equal(first?.headers?.["x-inbox-matched"], "28");
  assert.equal(first?.headers?.["x-inbox-more"], "true");
  assert.equal(second?.headers?.["x-inbox-shown"], "28");
  assert.equal(second?.headers?.["x-inbox-more"], "false");
  const headers = headersOf(render("baseline"));
  const loaded = [...rowsOf(first?.body ?? ""), ...rowsOf(second?.body ?? "")];
  assert.equal(loaded.length, 28);
  assert.deepEqual(readColumns(headers, loaded, ["From", "Account", "Kind", "Age"]), declared.records);
});

test("a quiet inbox fits the same backlog on one page and offers nothing older", () => {
  const declared = manifest.workflows?.find(({ id }) => id === "unanswered-backlog")?.variants?.[0]?.expected.extracted?.[0];
  assert.equal(declared?.count, 3);
  assert.equal(declared.pages, 1);
  const quiet = armed("quiet-inbox");
  const first = scenario.route?.(quiet, request("items", { account: BACKLOG_ACCOUNT, status: "unanswered", age: "over-3d", page: "1" }), context);
  assert.equal(first?.headers?.["x-inbox-more"], "false");
  assert.equal(rowsOf(first?.body ?? "").length, 3);
  // Only the old backlog moves: the newest conversations are untouched.
  assert.ok(inboxCounts(conversationsFor("quiet-inbox")).unansweredCount < inboxCounts(conversationsFor("baseline")).unansweredCount);
  assert.equal(inboxCounts(conversationsFor("quiet-inbox")).conversationCount, INBOX_SIZE);
});

test("the extraction targets match only conversation rows, and read the list through its headers", () => {
  const steps = [manifest.recordingScript, ...(manifest.workflows ?? []).map(({ recordingScript }) => recordingScript)].flat();
  const listSteps = steps.filter(({ operation, target }) => operation === "extract" && target?.includes("inbox-rows"));
  assert.equal(listSteps.length, 2);
  for (const step of listSteps) {
    assert.equal(step.target, "[data-testid=\"inbox-rows\"] > tr[data-conversation-id]");
    for (const selector of Object.values(step.fields ?? {})) assert.match(selector, /^column:/u, selector);
  }
});

test("the empty state is a row nothing reads as a conversation", () => {
  const empty = scenario.route?.(scenario.createState(scenario.seed), request("items", { q: "nothing matches this at all" }), context);
  assert.equal(empty?.headers?.["x-inbox-matched"], "0");
  assert.equal(empty?.headers?.["x-inbox-more"], "false");
  assert.equal(rowsOf(empty?.body ?? "").length, 0);
  assert.match(empty?.body ?? "", /Nothing here/u);
});

test("replying records one answer, marks the conversation handled, and moves the oracle", () => {
  const state = apply(scenario.createState(scenario.seed), "reply", { id: REPLY_TARGET.id, text: "Thank you, Priya." });
  assert.deepEqual(state.replies, [{ id: REPLY_TARGET.id, text: "Thank you, Priya." }]);
  assert.equal(state.oracle.unansweredCount, 186);
  const after = applyInboxChanges(conversationsFor("baseline"), state).find(({ id }) => id === REPLY_TARGET.id);
  assert.equal(after?.status, "Handled");
  // A second reply to the same conversation, an unknown id, and an empty reply all change nothing.
  assert.deepEqual(apply(state, "reply", { id: REPLY_TARGET.id, text: "again" }), state);
  assert.deepEqual(apply(state, "reply", { id: "cnv_zzzzzz", text: "hello" }), state);
  assert.deepEqual(apply(state, "reply", { id: REPLY_TARGET.id, text: "   " }), state);
});

test("marking handled and assigning record only conversations that exist and teammates that do", () => {
  const [first, second] = conversationsFor("baseline");
  assert.ok(first && second);
  const handled = apply(scenario.createState(scenario.seed), "mark-handled", { ids: [first.id, "cnv_zzzzzz"] });
  assert.deepEqual(handled.handled, [first.id]);
  const assigned = apply(handled, "assign", { ids: [second.id], to: INBOX_TEAM[0] });
  assert.deepEqual(assigned.assigned, [{ id: second.id, to: INBOX_TEAM[0] }]);
  assert.deepEqual(apply(handled, "assign", { ids: [second.id], to: "Someone Else" }), handled);
  assert.deepEqual(apply(handled, "assign", { ids: [], to: INBOX_TEAM[0] }), handled);
  assert.deepEqual(apply(assigned, "set-mode", { mode: "baseline" }).assigned, []);
  assert.deepEqual(apply(assigned, "no-such-operation", { ids: [first.id] }), assigned);
  assert.deepEqual(apply(assigned, "set-mode", { mode: "not-a-mode" }), assigned);
});

test("the route serves the conversation's own page, records the visit, and 404s anything else", () => {
  const state = apply(scenario.createState(scenario.seed), "reply", { id: REPLY_TARGET.id, text: "Thank you, Priya." });
  const detail = scenario.route?.(state, request(`conversations/${REPLY_TARGET.id}`), context);
  assert.equal(detail?.status, 200);
  assert.deepEqual(detail?.mutation, { operation: "open-conversation", payload: { id: REPLY_TARGET.id } });
  const declared = manifest.workflows?.find(({ id }) => id === "open-conversation")?.expected.extracted?.[0]?.records?.[0];
  assert.ok(declared);
  for (const [field, value] of Object.entries(declared)) {
    const shown: string | undefined = new RegExp(`data-testid="detail-${field}">([^<]*)<`, "u").exec(detail?.body ?? "")?.[1];
    // The run that reads this page has replied to nothing, so its status is the authored one.
    if (field !== "status") assert.equal(cellText(shown ?? ""), value, field);
  }
  assert.ok((detail?.body ?? "").includes("Thank you, Priya."), "a reply the run sent shows on the conversation's page");
  for (const subpath of ["conversations/cnv_zzzzzz", "conversations", "elsewhere"]) {
    assert.equal(scenario.route?.(state, request(subpath), context), undefined, subpath);
  }
});
