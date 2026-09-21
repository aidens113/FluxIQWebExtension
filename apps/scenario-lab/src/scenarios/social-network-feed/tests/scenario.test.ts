import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { escapeHtml } from "../../../html.js";
import { FEED_BEFORE_CAUGHT_UP, feedPlanFor, FRIEND_REQUESTS, fullDateText, OPEN_DAY_POST, shortDateText } from "../content/index.js";
import { GROUP_POST_TEXT, MOVED_OPEN_DAY_TEXT } from "../manifest.js";
import { cutText, feedClasses, pendingBoxText, SEE_MORE_AFTER } from "../markup/index.js";
import { socialNetworkFeedScenario as scenario } from "../scenario.js";
import type { FeedMode, FeedState } from "../types.js";

const manifest = scenario.manifest;
const context = { runToken: "social-network-feed-unit-token", seed: 5101, alternateOrigin: "http://127.0.0.1:9" };
const apply = (state: FeedState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const fresh = () => scenario.createState(scenario.seed);
const armed = (mode: FeedMode) => apply(fresh(), "set-mode", { mode });
const request = (subpath: string, query = "") => ({ subpath, query: new URLSearchParams(query), method: "GET" as const });
const route = (state: FeedState, subpath: string, query = "", seed = context.seed) => scenario.route?.(state, request(subpath, query), { ...context, seed });
/** The document without its script, which quotes class names and markup that are not on the page. */
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

type Selection = { workflowId?: string; variantId?: string };

function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

test("the manifest is valid, with four workflows, three variants, and no row judged on a refusal", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["feed-digest", "confirm-requests", "move-open-day"]);
  assert.deepEqual(selections().map(({ workflowId, variantId }) => `${workflowId ?? "primary"}/${variantId ?? "-"}`), [
    "primary/-", "primary/regrouped", "feed-digest/-", "feed-digest/quiet-feed", "feed-digest/app-install", "confirm-requests/-", "move-open-day/-",
  ]);
  for (const selection of selections()) {
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    assert.equal(expected.failure, undefined);
    const { atLoad, afterArm } = scenarioPageFactSchedule(manifest, selection, "arms-after-loading");
    assert.ok(atLoad.length > 0);
    assert.equal(afterArm.length > 0, selection.variantId !== undefined);
  }
});

test("the content is the same for every seed; only the build's class names move", () => {
  assert.deepEqual(scenario.createState(1), scenario.createState(99_999));
  const one = feedClasses(1);
  const two = feedClasses(2);
  assert.notEqual(one.unit, two.unit);
  const home = (seed: number) => markupOf(scenario.render(fresh(), { ...context, seed }));
  assert.notEqual(home(1), home(2));
  assert.equal(home(1).replaceAll(/x[0-9a-z]{6,7}/gu, "x"), home(2).replaceAll(/x[0-9a-z]{6,7}/gu, "x"));
  // A class is a style, not a role: the utility names are shared across unrelated roles.
  const utility = one.unit.split(" ")[1];
  assert.ok(utility && Object.values(one).filter((names) => names.split(" ").includes(utility)).length > 5);
  const roleClasses = Object.values(one).map((names) => names.split(" ")[0]);
  assert.equal(new Set(roleClasses).size, roleClasses.length);
});

test("the home page arrives with skeletons and no posts, and carries one test id, on the build marker", () => {
  const html = markupOf(scenario.render(fresh(), context));
  assert.equal(occurrences(html, "role=\"article\""), 0);
  assert.equal(occurrences(html, feedClasses(context.seed).skeleton), 3);
  assert.deepEqual([...html.matchAll(/data-testid="([^"]+)"/gu)].map((match) => match[1]), ["build-marker"]);
  assert.match(html, /Allow the use of cookies from Circleway on this browser\?/u);
  assert.ok(!markupOf(scenario.render(apply(fresh(), "consent", { choice: "all" }), context)).includes("Allow the use of cookies"), "an answered dialog stays answered");
  assert.match(html, /<input [^>]*type="search" placeholder="Search Circleway"/u);
  assert.ok(!/<label[^>]*>[^<]*Search Circleway/u.test(html), "the search box has a placeholder and no label");
});

test("the feed loads in batches of five down to You're all caught up, then suggestions, then stops", () => {
  const state = fresh();
  const batches: Array<{ html: string; next: number | null; caughtUp: boolean; texts: Record<string, string> }> = [];
  for (let cursor: number | null = 0; cursor !== null;) {
    const response = route(state, "feed/", `cursor=${cursor}`);
    assert.equal(response?.status, 200);
    assert.equal(response?.headers?.["content-type"], "application/json; charset=utf-8");
    const batch = JSON.parse(response?.body ?? "{}") as (typeof batches)[number];
    batches.push(batch);
    cursor = batch.next;
  }
  assert.deepEqual(batches.map(({ html }) => occurrences(html, "role=\"article\"")), [5, 5, 5, 5, 5, 5, 2, 2]);
  assert.deepEqual(batches.map(({ caughtUp }) => caughtUp), [false, false, false, false, false, true, false, false]);
  assert.equal(route(state, "feed/", "cursor=8")?.status, 404);
  const positions = batches.flatMap(({ html }) => [...html.matchAll(/aria-posinset="(\d+)"/gu)].map((match) => Number(match[1])));
  assert.deepEqual(positions, Array.from({ length: 34 }, (_unused, index) => index + 1));
  const long = Object.keys(Object.assign({}, ...batches.map(({ texts }) => texts)));
  assert.deepEqual(long.sort(), ["p_0a5d77", "p_2d80f5", "p_7c1e44", "p_d9e033"]);
  for (const batch of batches) for (const [id, text] of Object.entries(batch.texts)) {
    assert.ok(!batch.html.includes(escapeHtml(text)), `${id}: the whole text is not in the document before See more`);
    assert.ok(batch.html.includes(`${escapeHtml(cutText(text) ?? "")}… `), `${id}: the shortened start is`);
  }
});

test("the digest is the sixteen posts friends wrote themselves, in feed order, once each", () => {
  const digest = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest" }).expected.extracted?.[0];
  assert.equal(digest?.count, 16);
  const authors = digest?.records?.map(({ author }) => author);
  assert.ok(authors && !authors.includes("Maya Lindqvist"));
  assert.equal(new Set(digest?.records?.map(({ text }) => text)).size, 16, "no post twice, though two are shown twice");
  assert.deepEqual(digest?.records?.filter(({ group }) => group !== null).map(({ group }) => group), ["Riverside Allotment Society", "Harbourside Runners", "Old Town Bakers' Circle", "Riverside Allotment Society", "Harbourside Runners"]);
  assert.equal(digest?.records?.filter(({ reactions }) => reactions === null).length, 1);
  assert.equal(digest?.records?.filter(({ comments }) => comments === null).length, 3);
  assert.equal(resolveScenarioWorkflow(manifest, { workflowId: "feed-digest", variantId: "quiet-feed" }).expected.extracted?.[0]?.count, 7);
  const step = resolveScenarioWorkflow(manifest, { workflowId: "feed-digest" }).recordingScript.find(({ operation }) => operation === "extract");
  const plan = feedPlanFor({ mode: "baseline", created: [], trashed: [], hidden: [] });
  const picked = [...(step?.target ?? "").matchAll(/aria-posinset="(\d+)"/gu)].map((match) => Number(match[1]));
  const units = picked.map((position) => plan.batches.flat().find((entry) => entry.position === position)?.unit.kind);
  assert.ok(units.every((kind) => kind === "post"));
  assert.equal(FEED_BEFORE_CAUGHT_UP.filter((unit) => unit.kind === "post" && unit.text.length > SEE_MORE_AFTER).length, 4, "four friends' long posts and none of Maya's");
});

test("timestamps read short on the page and whole in the timestamp's label", () => {
  assert.equal(shortDateText(62), "1h");
  assert.equal(shortDateText(1_496), "1d");
  assert.equal(shortDateText(0), "Just now");
  assert.equal(shortDateText(8_840), "6d");
  assert.equal(shortDateText(20_000), "7 September at 11:40");
  assert.equal(fullDateText(62), "Monday 21 September 2026 at 07:58");
  assert.equal(fullDateText(0), "Monday 21 September 2026 at 09:00");
});

test("an advert's Sponsored label is not the word Sponsored in the document, and differs by build", () => {
  const first = JSON.parse(route(fresh(), "feed/", "cursor=0")?.body ?? "{}") as { html: string };
  const label = /data-lb="s_7f0c21-2-s"><span data-uid="s_7f0c21-2-s">(.*?)<\/span><\/a>/u.exec(first.html)?.[1] ?? "";
  const text = label.replaceAll(/<[^>]+>/gu, "");
  assert.notEqual(text, "Sponsored");
  assert.equal(label.replaceAll(/<span class="[^"]+">[a-z]<\/span>/gu, "").replaceAll(/<[^>]+>/gu, ""), "Sponsored");
  assert.ok(!first.html.includes(">Sponsored<"));
  const other = JSON.parse(route(fresh(), "feed/", "cursor=0", 77)?.body ?? "{}") as { html: string };
  assert.notEqual(other.html, first.html);
});

test("a group post goes to the admins; a filled trap field, an unknown group or an empty post goes nowhere", () => {
  const good = { group: "riverside-allotments", kind: "post", text: `  ${GROUP_POST_TEXT}\n`, website: "" };
  const posted = apply(fresh(), "group-post", good);
  assert.deepEqual(posted.pending, [{ group: "riverside-allotments", kind: "post", text: GROUP_POST_TEXT }]);
  const trapped = apply(fresh(), "group-post", { ...good, website: "https://example.test" });
  assert.deepEqual(trapped.pending, []);
  assert.equal(trapped.spam, 1);
  for (const bad of [{ ...good, group: "urban-growers" }, { ...good, group: "nowhere" }, { ...good, kind: "event" }, { ...good, text: "   " }, { ...good, text: 7 }]) {
    assert.deepEqual(apply(fresh(), "group-post", bad), fresh(), JSON.stringify(bad));
  }
  const box = route(posted, "groups/riverside-allotments/pending/")?.body ?? "";
  assert.equal(box.replaceAll(/<[^>]+>/gu, "").replaceAll("&#039;", "'"), pendingBoxText([{ kind: "post", text: GROUP_POST_TEXT }]));
  assert.equal(route(fresh(), "groups/riverside-allotments/pending/")?.body, "");
  const poll = apply(fresh(), "group-post", { ...good, kind: "poll" });
  assert.notEqual(route(poll, "groups/riverside-allotments/pending/")?.body?.replaceAll(/<[^>]+>/gu, "").replaceAll("&#039;", "'"), pendingBoxText([{ kind: "post", text: GROUP_POST_TEXT }]));
});

test("the group composer prompt is the one control with a test id, and regrouped takes it away", () => {
  const baseline = markupOf(route(fresh(), "groups/riverside-allotments/")?.body ?? "");
  assert.match(baseline, /data-testid="group-composer-prompt">Write something\.\.\.</u);
  const redesigned = markupOf(route(armed("regrouped"), "groups/riverside-allotments/")?.body ?? "");
  assert.ok(!redesigned.includes("group-composer-prompt"));
  for (const label of ["Create post", "Create poll", "Create event"]) assert.ok(redesigned.includes(`>${label}</div>`), label);
  assert.match(markupOf(scenario.render(armed("regrouped"), context)), /web 439\.0\.0\.12/u);
});

test("Maya's own post can be moved to the trash and posted again; nobody else's can", () => {
  const trashed = apply(fresh(), "trash-post", { id: OPEN_DAY_POST.id });
  assert.deepEqual(trashed.trashed, [OPEN_DAY_POST.id]);
  assert.deepEqual(apply(fresh(), "trash-post", { id: "p_4b2a10" }), fresh());
  const reposted = apply(trashed, "create-post", { text: MOVED_OPEN_DAY_TEXT, audience: "Public", website: "" });
  assert.deepEqual(reposted.created, [{ id: "p_f0a1f3", text: MOVED_OPEN_DAY_TEXT, audience: "Public" }]);
  assert.equal(apply(trashed, "create-post", { text: MOVED_OPEN_DAY_TEXT, audience: "Public", website: "x" }).created.length, 0);
  assert.deepEqual(apply(trashed, "create-post", { text: MOVED_OPEN_DAY_TEXT, audience: "Everyone" }), trashed);
  const first = JSON.parse(route(reposted, "feed/", "cursor=0")?.body ?? "{}") as { html: string };
  assert.ok(first.html.indexOf(MOVED_OPEN_DAY_TEXT) >= 0 && !first.html.includes(OPEN_DAY_POST.text));
  assert.ok(first.html.includes("aria-label=\"Monday 21 September 2026 at 09:00\""));
  assert.equal(route(reposted, "unit/p_f0a1f3/")?.status, 200);
  assert.equal(route(reposted, "unit/p_4b2a10/")?.status, 404, "only a post the run created is served as a lone unit");
  assert.equal(route(trashed, `posts/${OPEN_DAY_POST.id}/`)?.status, 404);
});

test("friend requests answer once, and the stale badge and the preview disagree with the list", () => {
  assert.deepEqual(FRIEND_REQUESTS.filter(({ mutualCount }) => mutualCount >= 5).map(({ person }) => person), ["amara-osei", "jonas-weber", "lin-zhao", "freya-holm"]);
  const confirmed = apply(fresh(), "confirm-request", { id: "rq_8b41c7" });
  assert.deepEqual(confirmed.requests, { rq_8b41c7: "confirmed" });
  assert.deepEqual(apply(confirmed, "delete-request", { id: "rq_8b41c7" }), confirmed);
  assert.deepEqual(apply(fresh(), "confirm-request", { id: "rq_nope" }), fresh());
  const home = markupOf(route(fresh(), "friends/")?.body ?? "");
  const list = markupOf(route(confirmed, "friends/requests/")?.body ?? "");
  assert.equal(occurrences(home, "aria-label=\"Confirm\""), 4);
  assert.equal(occurrences(list, "aria-label=\"Confirm\""), 7);
  assert.match(list, /7 friend requests/u);
  assert.match(list, /Request accepted<\/div><a [^>]*href="\/scenarios\/social-network-feed\/messages\/t\/amara-osei\/">Message<\/a>/u);
  assert.match(home, /aria-label="Friends"[^>]*>.*?<span[^>]*>4<\/span>/u);
});

test("arming clears what an earlier run did, and every route answers or says the content is not available", () => {
  const busy = apply(apply(fresh(), "consent", { choice: "all" }), "trash-post", { id: OPEN_DAY_POST.id });
  for (const mode of ["baseline", "regrouped", "quiet-feed", "app-install"] as const) {
    const state = apply(busy, "set-mode", { mode });
    assert.equal(state.mode, mode);
    assert.deepEqual({ ...state, mode: "baseline" }, fresh());
  }
  assert.deepEqual(apply(busy, "set-mode", { mode: "nonsense" }), busy);
  assert.match(markupOf(scenario.render(armed("app-install"), context)), /data-testid="app-promo"/u);
  assert.ok(!markupOf(scenario.render(apply(armed("app-install"), "app-promo", { choice: "dismissed" }), context)).includes("app-promo"));
  const embed = route(fresh(), "embed/p_5e1f38");
  assert.equal(embed?.status, 200);
  assert.match(embed?.headers?.["content-security-policy"] ?? "", /frame-ancestors http:\/\/127\.0\.0\.1:\*/u);
  for (const subpath of ["posts/p_4b2a10/", "people/tom.becker.9/", "pages/greenleaf-seeds/", "groups/harbourside-runners/", "l/", "app-store/"]) {
    assert.equal(route(fresh(), subpath, "u=https%3A%2F%2Fexample.test%2F")?.status, 200, subpath);
  }
  for (const subpath of ["posts/h_b71d09/", "people/nobody/", "embed/p_4b2a10", "watch/", "elsewhere"]) {
    const response = route(fresh(), subpath);
    assert.equal(response?.status, 404, subpath);
    assert.match(response?.body ?? "", /This content isn't available right now/u);
  }
});
