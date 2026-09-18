import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { accountCellText, connectedAccounts } from "../accounts.js";
import { excerptOf, relativeText, slotText } from "../format.js";
import { queuePostsFor, QUEUE_SIZE, REFERENCE_NOW_MS } from "../posts.js";
import { applyChanges, composedPost, filterQueue, isComposedPost, orderedQueue, queueCounts, statsText } from "../queue.js";
import { socialSchedulerScenario as scenario } from "../scenario.js";
import { SCHEDULER_BUILDS, schedulerClasses } from "../styles.js";
import { POST_LIMIT, type SchedulerMode, type SchedulerState } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "social-scheduler-unit-token", seed: 171 };
const baselineCss = schedulerClasses(SCHEDULER_BUILDS.baseline);
const restyledCss = schedulerClasses(SCHEDULER_BUILDS.restyled);

const apply = (state: SchedulerState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const armed = (mode: SchedulerMode) => apply(scenario.createState(scenario.seed), "set-mode", { mode });
const render = (mode: SchedulerMode) => scenario.render(armed(mode), context);
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;
/** The document without the page's own script, which quotes selectors and class names that are not markup. */
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;

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

/** The queue table as a reader sees it: the header texts, then one array of cell texts per post row. */
function readTable(html: string): { headers: string[]; rows: string[][] } {
  const markup = markupOf(html);
  const table = markup.slice(markup.indexOf("<table"), markup.indexOf("</table>"));
  const headers = [...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gu)].map((match) => cellText(match[1] ?? ""));
  const rows = [...table.matchAll(/<tr class="[^"]*" data-post-id="[\s\S]*?<\/tr>/gu)]
    .map((match) => [...match[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map((cell) => cellText(cell[1] ?? "")));
  return { headers, rows };
}

/** What a `column:<header>` read of the rendered table yields for the named columns. */
function readColumns(html: string, columns: readonly string[]): Array<Record<string, string>> {
  const { headers, rows } = readTable(html);
  const indexes = columns.map((column) => {
    const index = headers.indexOf(column);
    assert.notEqual(index, -1, `the table has no ${column} column`);
    return [column, index] as const;
  });
  return rows.map((cells) => Object.fromEntries(indexes.map(([column, index]) => [column.toLowerCase(), cells[index] ?? ""])));
}

test("the manifest is a valid scenario with four workflows and five variants, each arming one mode", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["retry-failed", "week-ahead", "whole-queue"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [
      { id: "restyled", arm: { operation: "set-mode", payload: { mode: "restyled" } } },
      { id: "renamed-composer", arm: { operation: "set-mode", payload: { mode: "renamed-composer" } } },
    ],
    [{ id: "quiet-week", arm: { operation: "set-mode", payload: { mode: "quiet-week" } } }],
    [
      { id: "reordered-columns", arm: { operation: "set-mode", payload: { mode: "reordered-columns" } } },
      { id: "whats-new", arm: { operation: "set-mode", payload: { mode: "whats-new" } } },
    ],
    [],
  ]);
  assert.equal(selections().length, 9);
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

test("the queue is 280 authored posts on a fixed clock, identical for every seed", () => {
  const posts = queuePostsFor("baseline");
  assert.equal(posts.length, QUEUE_SIZE);
  assert.equal(new Set(posts.map(({ id }) => id)).size, QUEUE_SIZE);
  assert.deepEqual(queuePostsFor("baseline"), queuePostsFor("baseline"));
  assert.deepEqual(scenario.createState(1), scenario.createState(999));
  assert.equal(statsText(posts), "280 posts · 122 scheduled · 14 failed");
  assert.equal(slotText(0), "Mon 21 Sep 2026, 09:00");
  assert.equal(new Date(REFERENCE_NOW_MS).toISOString(), "2026-09-21T09:00:00.000Z");
  assert.equal(relativeText(0), "Now");
  assert.equal(relativeText(90), "In 1 hour");
  assert.equal(relativeText(-1_440), "Yesterday");
  assert.equal(relativeText(-20_160), "2 weeks ago");
});

test("a post's text is truncated at a word boundary and never longer than the column shows", () => {
  const posts = queuePostsFor("baseline");
  const excerpts = posts.map((post) => excerptOf(post.body));
  assert.ok(excerpts.some((excerpt) => excerpt.endsWith("…")), "no post is long enough to be cut");
  for (const excerpt of excerpts) assert.ok(excerpt.length <= 65, excerpt);
  for (const post of posts) assert.ok(post.body.length <= POST_LIMIT, post.id);
  // The same copy is scheduled to many accounts, so an excerpt names no single row.
  assert.ok(new Set(excerpts).size < posts.length / 10, "the queue's copy is too unique to be realistic");
});

test("two connected accounts share a display name and two share their avatar letters", () => {
  const displays = connectedAccounts.map(({ display }) => display);
  const initials = connectedAccounts.map(({ initials: letters }) => letters);
  assert.ok(displays.length - new Set(displays).size >= 1, "no two accounts share a display name");
  assert.ok(initials.length - new Set(initials).size >= 2, "no two accounts share their avatar letters");
  assert.equal(new Set(connectedAccounts.map(({ slug }) => slug)).size, connectedAccounts.length);
  const [first, second] = connectedAccounts.filter(({ display }) => display === "Northwind Outdoors");
  assert.ok(first && second);
  assert.notEqual(accountCellText(first), accountCellText(second));
});

test("the page renders every row, 280 identical action buttons, two controls named Search, and a collapsed composer", () => {
  const markup = markupOf(render("baseline"));
  assert.equal(occurrences(markup, "data-post-id=\""), QUEUE_SIZE);
  assert.equal(occurrences(markup, "aria-label=\"Post actions\""), QUEUE_SIZE);
  assert.equal(occurrences(markup, ">Search</label>"), 2);
  assert.match(markup, /data-testid="composer"[^>]*hidden/u);
  assert.equal(occurrences(markup, ">New post</button>"), 1);
  assert.equal(occurrences(markup, "class=\"" + baselineCss.iconButton + "\""), QUEUE_SIZE + 5);
  assert.ok(!markup.includes("data-testid=\"post-"), "a queue row must not label its own fields for a reader");
});

test("restyling changes every class name and nothing a person reads", () => {
  const baseline = markupOf(render("baseline"));
  const restyled = markupOf(render("restyled"));
  assert.notEqual(baselineCss.row, restyledCss.row);
  assert.equal(occurrences(restyled, baselineCss.row), 0);
  assert.equal(readTable(baseline).rows.length, readTable(restyled).rows.length);
  assert.deepEqual(readTable(baseline).rows, readTable(restyled).rows);
});

test("the recorded composer control is the one thing renamed-composer takes away", () => {
  const baseline = markupOf(render("baseline"));
  const renamed = markupOf(render("renamed-composer"));
  assert.ok(baseline.includes("data-testid=\"composer-submit\""));
  assert.ok(!renamed.includes("data-testid=\"composer-submit\""), "the recorded control must be gone");
  assert.ok(renamed.includes("data-testid=\"composer-queue\"") && renamed.includes(">Add to queue<"));
  for (const html of [baseline, renamed]) assert.ok(html.includes("data-testid=\"composer-draft\""), "the wrong answer stays pressable");
  assert.deepEqual(readTable(baseline).rows, readTable(renamed).rows);
});

test("reordering the columns moves the headers and their cells together, and changes no text", () => {
  const baseline = readTable(render("baseline"));
  const reordered = readTable(render("reordered-columns"));
  assert.deepEqual(baseline.headers, ["", "Post", "Account", "Scheduled", "Status", "Actions"]);
  assert.deepEqual(reordered.headers, ["", "Status", "Account", "Post", "Scheduled", "Actions"]);
  assert.notDeepEqual(baseline.rows, reordered.rows);
  const columns = ["Post", "Account", "Scheduled", "Status"];
  assert.deepEqual(readColumns(render("baseline"), columns), readColumns(render("reordered-columns"), columns));
});

test("every declared dataset is what a column read of the rendered table returns", () => {
  const wholeQueue = manifest.workflows?.find(({ id }) => id === "whole-queue")?.expected.extracted?.[0];
  assert.ok(wholeQueue?.records);
  assert.equal(wholeQueue.count, QUEUE_SIZE);
  assert.deepEqual(readColumns(render("baseline"), ["Account", "Post", "Scheduled", "Status"]), wholeQueue.records);
  assert.deepEqual(readColumns(render("reordered-columns"), ["Account", "Post", "Scheduled", "Status"]), wholeQueue.records);
});

test("the coming week and the week's failures are the rows the toolbar would leave showing", () => {
  const weekAhead = manifest.workflows?.find(({ id }) => id === "week-ahead")?.expected.extracted?.[0];
  const expected = orderedQueue(filterQueue(queuePostsFor("baseline"), { search: "", account: "photogram-northwind-trails", status: "", range: "next-7" }));
  assert.equal(weekAhead?.count, expected.length);
  assert.equal(expected.length, 14);
  assert.ok(expected.every((post) => post.status === "Scheduled" && post.offsetMinutes >= 0 && post.offsetMinutes < 10_080));
  const retried = manifest.workflows?.find(({ id }) => id === "retry-failed")?.expected.extracted?.[0];
  assert.equal(retried?.count, 10);
  assert.ok(retried.records?.every((record) => record.status === "Queued"), "a retry report can only be produced by a retry");
  const quiet = manifest.workflows?.find(({ id }) => id === "retry-failed")?.variants?.[0]?.expected.extracted?.[0];
  assert.equal(quiet?.count, 3);
});

test("the extraction targets match only posted rows, never the empty state", () => {
  const steps = [manifest.recordingScript, ...(manifest.workflows ?? []).map(({ recordingScript }) => recordingScript)].flat();
  const targets = steps.filter(({ operation }) => operation === "extract").map(({ target }) => target);
  assert.equal(targets.length, 3);
  for (const target of targets) assert.equal(target, "[data-testid=\"queue-rows\"] > tr[data-post-id]");
  for (const step of steps.filter(({ operation }) => operation === "extract")) {
    for (const selector of Object.values(step.fields ?? {})) assert.match(selector, /^column:/u, selector);
  }
});

test("scheduling records only a post the composer could have sent, and the oracle follows it", () => {
  const good = { accountSlug: "photogram-northwind-trails", body: "Trail clean-up on Saturday.", date: "2026-09-24", time: "09:00" };
  assert.equal(isComposedPost(good), true);
  const state = apply(scenario.createState(scenario.seed), "schedule-post", good);
  assert.equal(state.composed.length, 1);
  assert.deepEqual(state.oracle, { postCount: QUEUE_SIZE + 1, scheduledCount: 123, failedCount: 14 });
  assert.equal(composedPost(good, 0).offsetMinutes, 4_320);
  for (const bad of [
    { ...good, accountSlug: "no-such-account" },
    { ...good, date: "24/09/2026" },
    { ...good, time: "9am" },
    { ...good, body: "   " },
    { ...good, body: 7 },
  ]) {
    assert.equal(isComposedPost(bad), false, JSON.stringify(bad));
    assert.deepEqual(apply(scenario.createState(scenario.seed), "schedule-post", bad), scenario.createState(scenario.seed));
  }
});

test("a retry moves only failures into the queue, and arming clears what a run did", () => {
  const failed = queuePostsFor("baseline").filter((post) => post.status === "Failed").map(({ id }) => id);
  const published = queuePostsFor("baseline").filter((post) => post.status === "Published").map(({ id }) => id);
  const state = apply(scenario.createState(scenario.seed), "retry-posts", { ids: [...failed.slice(0, 3), published[0], "pst_nope"] });
  assert.deepEqual(state.retried, failed.slice(0, 3));
  assert.equal(state.oracle.failedCount, 14 - 3);
  const queued = applyChanges(queuePostsFor("baseline"), state.retried, []).filter((post) => post.status === "Queued");
  assert.equal(queued.length, 3);
  assert.deepEqual(apply(state, "set-mode", { mode: "baseline" }).retried, []);
  assert.deepEqual(apply(state, "retry-posts", { ids: "not-an-array" }).retried, state.retried);
  assert.deepEqual(apply(state, "no-such-operation", { ids: failed }), state);
  assert.deepEqual(apply(state, "set-mode", { mode: "not-a-mode" }), state);
});

test("whats-new stands an announcement in front of an inert console and changes nothing else", () => {
  const baseline = markupOf(render("baseline"));
  const announcing = markupOf(render("whats-new"));
  assert.equal(occurrences(baseline, `data-testid="whats-new"`), 0);
  assert.equal(occurrences(announcing, `data-testid="whats-new"`), 1);
  assert.match(announcing, /role="dialog" aria-modal="true" aria-labelledby="whats-new-title"/u);
  assert.ok(announcing.includes(`<div class="${baselineCss.app}" inert>`), "the console behind the announcement is inert");
  assert.ok(announcing.includes(`data-action="dismiss-whats-new">Got it</button>`));
  assert.deepEqual(readColumns(announcing, ["Account", "Post", "Scheduled", "Status"]), readColumns(baseline, ["Account", "Post", "Scheduled", "Status"]));
  assert.deepEqual(queueCounts(queuePostsFor("whats-new")), queueCounts(queuePostsFor("baseline")));
  const script = render("whats-new").slice(render("whats-new").indexOf("<script"));
  assert.ok(script.includes("removeAttribute('inert')"), "closing the announcement gives the console back");
});

test("quiet-week thins only the week's failures", () => {
  const baseline = queueCounts(queuePostsFor("baseline"));
  const quiet = queueCounts(queuePostsFor("quiet-week"));
  assert.equal(baseline.postCount, quiet.postCount);
  assert.equal(baseline.scheduledCount, quiet.scheduledCount);
  assert.ok(quiet.failedCount < baseline.failedCount, "a quiet week must fail fewer posts");
});

test("the route serves a row, a post page and an account page, and 404s anything else", () => {
  const request = (subpath: string) => ({ subpath, query: new URLSearchParams(), method: "GET" as const });
  const state = apply(scenario.createState(scenario.seed), "schedule-post", {
    accountSlug: "photogram-northwind-trails", body: "Trail clean-up on Saturday.", date: "2026-09-24", time: "09:00",
  });
  const row = scenario.route?.(state, request("rows/pst_new001"), context);
  assert.equal(row?.status, 200);
  assert.match(row?.body ?? "", /^<tr class="[^"]*" data-post-id="pst_new001"/u);
  assert.equal(row?.mutation, undefined, "rendering a row is not a visit");
  const post = scenario.route?.(state, request("posts/pst_new001"), context);
  assert.equal(post?.status, 200);
  assert.deepEqual(post?.mutation, { operation: "view-post", payload: { id: "pst_new001" } });
  assert.ok((post?.body ?? "").includes("Trail clean-up on Saturday."), "the post page shows the whole post");
  const account = scenario.route?.(state, request("accounts/chirp-northwind-outdoors"), context);
  assert.equal(account?.status, 200);
  assert.ok((account?.body ?? "").includes("Another connected account is also called Northwind Outdoors"));
  for (const subpath of ["rows/pst_zzzzzz", "posts/pst_zzzzzz", "accounts/nobody", "elsewhere"]) {
    assert.equal(scenario.route?.(state, request(subpath), context), undefined, subpath);
  }
});
