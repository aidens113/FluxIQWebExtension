import assert from "node:assert/strict";
import test from "node:test";
import type { RenderContext } from "../../../types.js";
import { listingByKey } from "../catalog/index.js";
import { CONTACT_INTERVAL_MS, contactAllowed, HUMAN_CHECK_WINDOW_MS, humanCheckDue } from "../limits.js";
import { buyingCount, offerReceiptText } from "../readouts.js";
import { routeClassifieds } from "../route.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import { createClassifiedsState, mutateClassifiedsState } from "../state.js";
import { OFFER_LISTING_KEY } from "../targets.js";
import type { ClassifiedsMode, ClassifiedsState } from "../types.js";

const NOW = 1_800_000_000_000;
const context: RenderContext = { runToken: "local-classifieds-unit-token", seed: 44, alternateOrigin: "http://127.0.0.1:9" };
const bike = listingByKey(OFFER_LISTING_KEY);
const apply = (state: ClassifiedsState, operation: string, payload: unknown, now = NOW) => mutateClassifiedsState(state, operation, payload, now);
const armed = (mode: ClassifiedsMode) => apply(createClassifiedsState(), "set-mode", { mode });
const route = (state: ClassifiedsState, subpath: string, query = "", now = NOW, seed = 44) =>
  routeClassifieds(state, { subpath, query: new URLSearchParams(query), method: "GET" }, { ...context, seed }, now);
const body = (response: ReturnType<typeof route>) => { assert.ok(response, "routed"); return response.body ?? ""; };
const json = (response: ReturnType<typeof route>) => JSON.parse(body(response)) as Record<string, unknown>;
const testIds = (html: string) => [...html.matchAll(/data-testid="([^"]+)"/gu)].map((match) => match[1]).sort();
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));

test("a session starts with two saves, two conversations and every question unanswered, whatever the seed", () => {
  const state = createClassifiedsState();
  assert.equal(state.saved.length, 2);
  assert.equal(buyingCount(state), 2);
  assert.deepEqual([state.consent, state.notificationPrompt, state.locationCheck, state.chat], ["pending", "pending", "pending", "unopened"]);
  assert.deepEqual(scenario.createState(3), scenario.createState(44));
});

test("set-mode arms a rendering and starts the session over; nonsense changes nothing", () => {
  const busy = apply(apply(createClassifiedsState(), "consent", { choice: "all" }), "save", { listingId: bike.id, saved: true });
  const rearmed = apply(busy, "set-mode", { mode: "moved-save" });
  assert.deepEqual(rearmed, createClassifiedsState("moved-save"));
  for (const [operation, payload] of [["set-mode", { mode: "nope" }], ["consent", { choice: "maybe" }], ["save", { listingId: "1", saved: true }], ["teleport", {}], ["save", null]] as const) {
    assert.deepEqual(apply(busy, operation, payload), busy, operation);
  }
});

test("Save toggles, so a second press undoes the first; Hide hides and unsaves", () => {
  const once = apply(createClassifiedsState(), "save", { listingId: bike.id, saved: true });
  assert.ok(once.saved.includes(bike.id));
  assert.ok(!apply(once, "save", { listingId: bike.id, saved: false }).saved.includes(bike.id));
  const hidden = apply(once, "hide", { listingId: bike.id });
  assert.deepEqual(hidden.hidden, [bike.id]);
  assert.ok(!hidden.saved.includes(bike.id));
});

test("an offer is delivered, held when the honeypot is filled, refused inside the rate limit, and ignored when it could not have been sent", () => {
  const delivered = apply(createClassifiedsState(), "send-offer", { listingId: bike.id, amount: 140, note: "", website: "" });
  assert.deepEqual(delivered.offers, [{ listingId: bike.id, amount: 140, note: "", delivered: true }]);
  assert.equal(offerReceiptText(delivered.offers[0]!), "Offer of £140 sent to Morgan Tate");
  assert.equal(buyingCount(delivered), 3);
  const held = apply(createClassifiedsState(), "send-offer", { listingId: bike.id, amount: 140, note: "", website: "140" });
  assert.equal(offerReceiptText(held.offers[0]!), "Offer of £140 not delivered");
  const messaged = apply(createClassifiedsState(), "send-message", { listingId: bike.id, text: "Hi, is this still available?", website: "" });
  const refused = apply(messaged, "send-offer", { listingId: bike.id, amount: 140 }, NOW + CONTACT_INTERVAL_MS - 1);
  assert.deepEqual([refused.offers.length, refused.refusedContacts], [0, 1]);
  assert.equal(apply(refused, "send-offer", { listingId: bike.id, amount: 140 }, NOW + CONTACT_INTERVAL_MS).offers.length, 1);
  for (const payload of [{ listingId: bike.id, amount: 165_140 }, { listingId: bike.id, amount: 0 }, { listingId: bike.id, amount: 12.5 }, { listingId: listingByKey("folding-sold").id, amount: 100 }, { listingId: listingByKey("old-kids").id, amount: 1 }]) {
    assert.deepEqual(apply(createClassifiedsState(), "send-offer", payload).offers, [], JSON.stringify(payload));
  }
});

test("the speed limits sit where a person never meets them", () => {
  assert.equal(contactAllowed([], NOW), true);
  assert.equal(contactAllowed([NOW], NOW + CONTACT_INTERVAL_MS - 1), false);
  assert.equal(contactAllowed([NOW], NOW + CONTACT_INTERVAL_MS), true);
  assert.equal(humanCheckDue([NOW, NOW + 1], NOW + 2), false, "a third search in the window goes through");
  assert.equal(humanCheckDue([NOW, NOW + 1, NOW + 2], NOW + 3), true, "a fourth is checked");
  assert.equal(humanCheckDue([NOW, NOW + 1, NOW + 2], NOW + HUMAN_CHECK_WINDOW_MS + 1), false, "old searches age out");
});

test("the feed sends batches, pauses a fourth quick search, fails one batch once, and ends outside the search", () => {
  const query = "category=bicycles&surface=category&radius=10&minPrice=100&maxPrice=400&itemCondition=new,used_like_new,used_good&sortBy=price_ascend";
  let state = createClassifiedsState();
  const first = route(state, "feed.json", `${query}&batch=0`);
  assert.deepEqual(first?.mutation, { operation: "feed-request", payload: { at: NOW } });
  assert.equal(first?.headers?.["content-type"], "application/json; charset=utf-8");
  assert.equal(json(first).next, 1);
  for (let search = 0; search < 3; search += 1) state = apply(state, "feed-request", { at: NOW + search });
  const paused = route(state, "feed.json", `${query}&batch=0`, NOW + 3);
  assert.deepEqual(json(paused), { challenge: true });
  state = apply(state, "pass-check", {});
  assert.equal(json(route(state, "feed.json", `${query}&batch=0`, NOW + 4)).next, 1);
  const failing = route(state, "feed.json", `${query}&batch=2`);
  assert.deepEqual(json(failing), { error: "Couldn't load more listings." });
  state = apply(state, failing!.mutation!.operation, failing!.mutation!.payload);
  const retried = json(route(state, "feed.json", `${query}&batch=2`));
  assert.equal(retried.next, null);
  assert.match(String(retried.end), /Results outside your search/u);
  assert.equal(route(state, "feed.json", "surface=elsewhere&batch=0"), undefined);
  assert.equal(route(state, "feed.json", "surface=category&category=boats&batch=0"), undefined);
});

test("only readouts carry test ids, plus the one control the recording names; the redesign takes that one away", () => {
  const home = markupOf(scenario.render(createClassifiedsState(), context));
  assert.deepEqual(testIds(home), ["marketplace_buying_count", "marketplace_saved_badge"]);
  const detail = String(json(route(createClassifiedsState(), `item/${bike.id}/detail.json`)).html);
  assert.deepEqual(testIds(detail), ["marketplace_pdp_save"]);
  const redesigned = String(json(route(armed("moved-save"), `item/${bike.id}/detail.json`)).html);
  assert.deepEqual(testIds(redesigned), []);
  assert.match(redesigned, />Hide</u);
  assert.match(markupOf(body(route(armed("moved-save"), `item/${bike.id}/`))), /aria-label="Add to saved items"/u);
  const offered = apply(createClassifiedsState(), "send-offer", { listingId: bike.id, amount: 140 });
  assert.deepEqual(testIds(String(json(route(offered, `item/${bike.id}/detail.json`)).html)), ["marketplace_offer_receipt", "marketplace_pdp_save"]);
  assert.deepEqual(json(route(offered, `item/${bike.id}/receipt.json`)), { receipt: "Offer of £140 sent to Morgan Tate", buying: 3 });
  assert.match(markupOf(scenario.render(armed("location-check"), context)), /data-testid="marketplace_location_prompt" hidden/u);
});

test("every class name and id is the seed's build: two seeds share none of them, and no element has an authored id", () => {
  const classesOf = (html: string) => new Set([...markupOf(html).matchAll(/class="([^"]+)"/gu)].flatMap((match) => match[1]!.split(" ")));
  const page = (seed: number) => body(route(createClassifiedsState(), "category/bicycles/", "", NOW, seed));
  const [one, two] = [classesOf(page(1)), classesOf(page(2))];
  assert.ok(one.size > 20);
  assert.deepEqual([...one].filter((name) => two.has(name)), []);
  for (const name of one) assert.match(name, /^x[0-9a-z]+$/u);
  const ids = [...markupOf(page(1)).matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.match(id!, /^:r[0-9a-v]+:$/u);
});

test("the list layout serves rows whose link wraps only the title", () => {
  const grid = markupOf(body(route(createClassifiedsState(), "category/bicycles/")));
  const list = markupOf(body(route(armed("list-layout"), "category/bicycles/")));
  assert.doesNotMatch(grid, /role="article"/u);
  assert.match(list, /role="article"/u);
  const titleLink = new RegExp(`<a class="[^"]+" href="/scenarios/local-classifieds/item/${listingByKey("kids-mtb-24").id}/">Kids&#039; mountain bike, 24in wheels</a>`, "u");
  assert.match(list, titleLink);
});

test("every address answers as a page, a cross-origin map, a shop, or not at all", () => {
  const state = createClassifiedsState();
  const item = route(state, `item/${bike.id}/`);
  assert.deepEqual(item?.mutation, { operation: "view", payload: { id: bike.id } });
  for (const path of ["saved/", "inbox/", "buying/", "notifications/", "selling/", "browse/", "search/"]) assert.equal(route(state, path)?.status, 200, path);
  assert.match(body(route(state, "search/", "query=folding+bike")), /Results for &quot;folding bike&quot;/u);
  assert.match(body(route(state, "people/", "q=bike")), /See results for &quot;bike&quot; in Marketplace/u);
  const map = route(state, "map/upper-kelford/");
  assert.match(String(map?.headers?.["content-security-policy"]), /frame-ancestors http:\/\/127\.0\.0\.1:\*/u);
  assert.match(body(route(state, "ad/vm-folding-clearance/")), /Not a Kerbfind Marketplace listing\./u);
  assert.match(String(json(route(state, `item/${bike.id}/detail.json`)).html), /src="http:\/\/127\.0\.0\.1:9\/scenarios\/local-classifieds\/map\/upper-kelford\/"/u);
  for (const path of ["item/123/", "item/1000000000000000/", "category/boats/", "ad/nope/", "map/atlantis/", "nowhere"]) assert.equal(route(state, path), undefined, path);
});

test("the saved page lists newest first, with its own live total and the sold item's status", () => {
  const saved = apply(createClassifiedsState(), "save", { listingId: listingByKey("glass-table").id, saved: true });
  const html = markupOf(body(route(saved, "saved/")));
  assert.match(html, /data-testid="marketplace_saved_total">3 saved items</u);
  const titles = [...html.matchAll(/class="[^"]+" href="\/scenarios\/local-classifieds\/item\/\d+\/">([^<]+)<\/a>/gu)].map((match) => match[1]);
  assert.deepEqual(titles, ["Glass dining table with chrome legs", "Adjustable desk lamp, black", "Rattan armchair"]);
  assert.match(html, />Sold</u);
  assert.match(html, />Price dropped</u);
});
