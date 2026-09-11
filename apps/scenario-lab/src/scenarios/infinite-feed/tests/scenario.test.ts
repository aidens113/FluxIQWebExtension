import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import type { ScenarioRouteRequest } from "../../../types.js";
import { FEED_PAGE_SIZE, feedItem, feedPageItems } from "../feed-content.js";
import { FEED_PAGE_HEIGHT_PX } from "../feed-markup.js";
import { infiniteFeedScenario as scenario, type InfiniteFeedState } from "../scenario.js";

const context = { runToken: "unit-test-run-token-0123", seed: 42 };
const request = (subpath: string, method: ScenarioRouteRequest["method"] = "GET"): ScenarioRouteRequest => ({ subpath, query: new URLSearchParams(), method });
const itemCount = (html: string) => html.match(/<article class="feed-item" data-testid="feed-item"/g)?.length ?? 0;

function apply(state: InfiniteFeedState, ...operations: Array<[string, unknown]>): InfiniteFeedState {
  return operations.reduce((current, [operation, payload]) => scenario.mutate(current, operation, payload), state);
}

function openedWithPages(pages: number, armed?: "end-early"): InfiniteFeedState {
  let state = scenario.createState(42);
  if (armed) state = scenario.mutate(state, "set-mode", { mode: armed });
  state = scenario.mutate(state, "open", {});
  for (let page = 2; page <= pages; page += 1) state = scenario.mutate(state, "load-page", { page });
  return state;
}

test("manifest is valid and scripts W11 as three page-sized scrolls, page waits, and an extract of 40 posts", () => {
  const manifest = scenario.manifest;
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath], ["infinite-feed", 116, "/scenarios/infinite-feed/"]);
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.recordingScript.map(({ operation }) => operation), ["scroll", "waitForState", "scroll", "waitForState", "scroll", "waitForState", "extract", "checkpoint"]);
  const scrolls = manifest.recordingScript.filter(({ operation }) => operation === "scroll");
  // Each step is more than one page, so it reaches the sentinel, and less than two, so its size still reads as one page.
  assert.ok(scrolls.every(({ value }) => typeof value === "number" && value > FEED_PAGE_HEIGHT_PX && value < 2 * FEED_PAGE_HEIGHT_PX));
  assert.deepEqual(manifest.recordingScript.filter(({ operation }) => operation === "waitForState").map(({ target }) => target), ["testid:feed-page-2", "testid:feed-page-3", "testid:feed-page-4"]);
  assert.deepEqual(manifest.recordingScript.find(({ operation }) => operation === "extract"), {
    id: "extract-loaded-posts", operation: "extract", target: "testid:feed-item",
    fields: { title: "testid:feed-item-title", author: "testid:feed-item-author", published: "testid:feed-item-time@datetime" },
  });
  assert.equal((1 + scrolls.length) * FEED_PAGE_SIZE, 40);
  assert.deepEqual(manifest.expected.extracted, [{ step: "extract-loaded-posts", count: 40 }]);
  assert.equal(manifest.expected.failure, undefined);
  assert.equal(manifest.workflows, undefined);
});

test("end-early variant is armed by one mutate and expects success with 25 posts", () => {
  const manifest = scenario.manifest;
  assert.deepEqual(manifest.variants?.map(({ id }) => id), ["end-early"]);
  const resolved = resolveScenarioWorkflow(manifest, { variantId: "end-early" });
  assert.deepEqual(resolved.expected.extracted, [{ step: "extract-loaded-posts", count: 25 }]);
  assert.equal(resolved.expected.failure, undefined);
  assert.deepEqual(resolved.expected.actions, manifest.expected.actions);
  assert.deepEqual(resolved.expected.finalState?.map(({ id }) => id), ["all-posts-loaded", "end-of-feed-shown", "page-4-absent"]);
  assert.deepEqual(resolved.recordingScript, manifest.recordingScript);
  const arm = resolved.variant?.arm;
  assert.ok(arm);
  const armed = scenario.mutate(scenario.createState(manifest.seed), arm.operation, arm.payload);
  assert.deepEqual(armed, { mode: "end-early", feedLength: 25, loadedCount: 10, ended: false, sessions: 0, lastOperation: "mode-set" });
});

test("state, content, and the start document are deterministic from the seed", () => {
  assert.deepEqual(scenario.createState(42), scenario.createState(42));
  assert.deepEqual(scenario.createState(42), { mode: "baseline", feedLength: 60, loadedCount: 10, ended: false, sessions: 0, lastOperation: "seeded" });
  assert.deepEqual(feedItem(42, 7), feedItem(42, 7));
  const items = Array.from({ length: 60 }, (_, index) => feedItem(42, index + 1));
  assert.equal(new Set(items.map(({ title }) => title)).size, 60);
  assert.deepEqual(items.map(({ id }) => id), items.map((_, index) => `post-${index + 1}`));
  assert.ok(items.every((item, index) => index === 0 || item.published < (items[index - 1]?.published ?? "")), "newest first");
  assert.ok(items.every(({ published }) => /^2026-0[23]-\d\dT\d\d:00:00\.000Z$/.test(published)));
  const otherSeed = Array.from({ length: 60 }, (_, index) => feedItem(7, index + 1));
  assert.notDeepEqual(items.map(({ title, author }) => title + author), otherSeed.map(({ title, author }) => title + author));
  assert.deepEqual(feedPageItems(42, 3, 60).map(({ position }) => position), [21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  assert.deepEqual(feedPageItems(42, 3, 25).map(({ position }) => position), [21, 22, 23, 24, 25]);
  assert.deepEqual(feedPageItems(42, 4, 25), []);
  assert.equal(scenario.render(scenario.createState(42), context), scenario.render(scenario.createState(42), context));
});

test("open starts a session at page one and pages load strictly in order to the end", () => {
  const opened = scenario.mutate(scenario.createState(42), "open", {});
  assert.deepEqual(opened, { mode: "baseline", feedLength: 60, loadedCount: 10, ended: false, sessions: 1, lastOperation: "opened" });
  for (const payload of [{ page: 3 }, { page: 1 }, { page: "2" }, {}, null, "page-2"]) assert.deepEqual(scenario.mutate(opened, "load-page", payload), opened);
  assert.deepEqual(scenario.mutate(opened, "unknown", {}), opened);
  assert.deepEqual(scenario.mutate(opened, "load-page", { page: 2 }), { ...opened, loadedCount: 20, lastOperation: "page-loaded" });
  assert.equal(openedWithPages(4).loadedCount, 40);
  const ended = openedWithPages(6);
  assert.deepEqual(ended, { ...opened, loadedCount: 60, ended: true, lastOperation: "page-loaded" });
  for (const payload of [{ page: 7 }, {}, { page: undefined }]) assert.deepEqual(scenario.mutate(ended, "load-page", payload), ended);
  assert.deepEqual(scenario.mutate(ended, "open", {}), { ...opened, sessions: 2 });
});

test("set-mode arms end-early, clamps an open session, and restores the baseline", () => {
  const forty = openedWithPages(4);
  const armed = scenario.mutate(forty, "set-mode", { mode: "end-early" });
  assert.deepEqual(armed, { mode: "end-early", feedLength: 25, loadedCount: 25, ended: true, sessions: 1, lastOperation: "mode-set" });
  const reopened = scenario.mutate(armed, "open", {});
  assert.deepEqual(reopened, { ...armed, loadedCount: 10, ended: false, sessions: 2, lastOperation: "opened" });
  const endedEarly = apply(reopened, ["load-page", { page: 2 }], ["load-page", { page: 3 }]);
  assert.deepEqual(endedEarly, { ...reopened, loadedCount: 25, ended: true, lastOperation: "page-loaded" });
  assert.deepEqual(scenario.mutate(endedEarly, "load-page", { page: 4 }), endedEarly);
  assert.deepEqual(scenario.mutate(endedEarly, "set-mode", { mode: "baseline" }), { ...endedEarly, mode: "baseline", feedLength: 60, ended: false, lastOperation: "mode-set" });
  for (const payload of [{ mode: "ends-early" }, {}, null]) assert.deepEqual(scenario.mutate(forty, "set-mode", payload), forty);
});

test("route serves the next page with its load mutation, 409 out of order, and 404 outside the feed", () => {
  const route = scenario.route;
  assert.ok(route);
  const opened = openedWithPages(1);
  const second = route(opened, request("page/2"), context);
  assert.equal(second?.status, 200);
  assert.deepEqual(second?.mutation, { operation: "load-page", payload: { page: 2 } });
  const body = second?.body ?? "";
  assert.equal(itemCount(body), FEED_PAGE_SIZE);
  assert.match(body, /^<div class="feed-page" data-testid="feed-page-2" data-page="2" data-last-page="false">/);
  for (const position of [11, 20]) assert.ok(body.includes(`aria-posinset="${position}"`), `position ${position}`);
  assert.ok(body.includes(`>${feedItem(42, 11).title}</h2>`));
  assert.ok(body.includes(`datetime="${feedItem(42, 20).published}"`));
  assert.deepEqual(route(opened, request("page/2", "HEAD"), context), second);
  assert.equal(scenario.mutate(opened, second?.mutation?.operation ?? "", second?.mutation?.payload).loadedCount, 20);

  assert.deepEqual(route(opened, request("page/3"), context), { status: 409, body: "" });
  assert.deepEqual(route(openedWithPages(6), request("page/6"), context), { status: 409, body: "" });
  for (const subpath of ["page/1", "page/7", "page/0", "page/02", "page/two", "pages/2", "page/2/more", "page"]) {
    assert.equal(route(opened, request(subpath), context), undefined, subpath);
  }

  const lastEarly = route(openedWithPages(2, "end-early"), request("page/3"), context);
  assert.equal(lastEarly?.status, 200);
  assert.equal(itemCount(lastEarly?.body ?? ""), 5);
  assert.match(lastEarly?.body ?? "", /data-testid="feed-page-3" data-page="3" data-last-page="true"/);
  assert.equal(route(openedWithPages(3, "end-early"), request("page/4"), context), undefined);
  assert.equal(route(openedWithPages(2, "end-early"), request("page/4"), context), undefined);
});

test("start document renders page one, the sentinel, hidden loading and end markers, and the fixture client", () => {
  const html = scenario.render(scenario.createState(42), context);
  assert.equal(itemCount(html), FEED_PAGE_SIZE);
  assert.ok(html.includes('role="feed" aria-label="Community posts" aria-busy="false" data-testid="feed"'));
  assert.ok(html.includes('data-testid="feed-page-1" data-page="1" data-last-page="false"'));
  assert.ok(html.includes('data-testid="feed-sentinel" aria-hidden="true"'));
  assert.ok(html.includes('data-testid="feed-loading" role="status" hidden'));
  assert.ok(html.includes('data-testid="feed-end" hidden'));
  assert.ok(html.includes(JSON.stringify(context.runToken)));
  assert.ok(html.includes("new IntersectionObserver"));
  assert.ok(html.includes(`>${feedItem(42, 1).title}</h2>`));
  assert.ok(!/Math\.random|Date\.now|new Date\(\)/.test(html));
  const endEarly = scenario.render(scenario.mutate(scenario.createState(42), "set-mode", { mode: "end-early" }), context);
  assert.equal(itemCount(endEarly), FEED_PAGE_SIZE);
  assert.ok(endEarly.includes('data-last-page="false"'));
});
