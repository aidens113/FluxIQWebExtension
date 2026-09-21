import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import type { ScenarioRouteResponse } from "../../../types.js";
import { listingByHandle } from "../catalog/index.js";
import { AUCTION_MARKETPLACE_LIVE_TASKS } from "../live-tasks.js";
import { AUCTION_MARKETPLACE_REPAIR_TASKS } from "../repair-tasks.js";
import { auctionMarketplaceScenario as scenario } from "../scenario.js";
import { applyAuctionMutation, createAuctionState } from "../state.js";
import type { AuctionMode, AuctionState } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "auction-marketplace-unit-token", seed: 4040, alternateOrigin: "http://127.0.0.1:9" };
const armed = (mode: AuctionMode) => scenario.mutate(scenario.createState(scenario.seed), "set-mode", { mode });
const get = (state: AuctionState, subpath: string, query = ""): ScenarioRouteResponse | undefined =>
  scenario.route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context);
const body = (response: ScenarioRouteResponse | undefined) => { assert.ok(response && response.status === 200); return response.body ?? ""; };
const markupOf = (html: string) => html.slice(0, html.indexOf("<script"));
const testIds = (html: string) => [...new Set([...markupOf(html).matchAll(/data-testid="([^"]+)"/gu)].map((match) => match[1]))].sort();
const occurrences = (html: string, needle: string) => html.split(needle).length - 1;

function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows!.find(({ id }) => id === workflowId)!;
    return [undefined, ...(workflow.variants ?? []).map(({ id }) => id)].map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

test("the manifest is a valid scenario: a bid, two workflows, three variants, every row judged on succeeding", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["watch-endings", "kestrel-auctions"]);
  assert.deepEqual([manifest, ...manifest.workflows!].map((workflow) => (workflow.variants ?? []).map(({ id }) => id)), [[], ["watch-redesign"], ["grid-view", "feedback-survey"]]);
  for (const selection of selections()) {
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    assert.ok((expected.finalState ?? []).length > 0, JSON.stringify(selection));
    assert.equal(expected.failure, undefined, JSON.stringify(selection));
    const { atLoad, afterArm } = scenarioPageFactSchedule(manifest, selection, "arms-after-loading");
    assert.ok(atLoad.length > 0);
    assert.equal(afterArm.length > 0, selection.variantId !== undefined, JSON.stringify(selection));
  }
  assert.deepEqual(scenario.createState(1), scenario.createState(99_999), "the lab seed reaches no state");
});

test("test ids mark only the account lists the oracle reads and the watch button's shipped hook, nothing else", () => {
  const state = createAuctionState();
  const pages = [
    scenario.render(state, context),
    body(get(state, "sch/i.html", "_nkw=kestrel+35")),
    body(get(state, `itm/${listingByHandle("m7").id}`)),
    body(get(state, "mye/watchlist")),
  ];
  const lists = ["bids-flyout", "followed-sellers", "purchases-flyout", "watch-flyout"];
  assert.deepEqual(testIds(pages[0]!), [...lists, "x-watch-cta"].sort());
  assert.deepEqual(testIds(pages[1]!), lists);
  assert.deepEqual(testIds(pages[2]!), [...lists, "x-watch-cta"].sort());
  assert.deepEqual(testIds(pages[3]!), lists);
  const redesign = armed("watch-redesign");
  assert.ok(!testIds(scenario.render(redesign, context)).includes("x-watch-cta"));
  assert.ok(!testIds(body(get(redesign, `itm/${listingByHandle("m1").id}`))).includes("x-watch-cta"));
  assert.match(body(get(redesign, `itm/${listingByHandle("m1").id}`)), /aria-label="Save item"/u);
});

test("a results page carries 24 organic cards and two advertisements, all as skeletons, and the ad label reads as noise", () => {
  const html = body(get(createAuctionState(), "sch/i.html", "_nkw=kestrel+35"));
  const markup = markupOf(html);
  assert.equal(occurrences(markup, "data-listingid="), 24);
  assert.equal(occurrences(markup, "data-adid="), 2);
  assert.ok(markup.includes(`data-adid="${listingByHandle("m4").id}"`), "the first advertisement is a genuine auction");
  assert.equal(occurrences(markup, `aria-busy="true"`), 1);
  const results = markup.slice(markup.indexOf(`aria-busy="true"`));
  assert.ok(!/£\d|EUR \d|US \$\d/u.test(results.slice(0, results.indexOf("</ul>"))), "no card is served with a price in it");
  const label = /<span class="[^"]+"><span>S<\/span>([\s\S]*?)<\/span><\/div>/u.exec(markup)?.[0] ?? "";
  const read = label.replace(/<[^>]+>/gu, "");
  assert.equal(read.length, 18, "nine letters shown and nine hidden between them");
  assert.notEqual(read, "Sponsored");
});

test("the condition links drop the buying format, the Next arrow is stuck from page two, and the page links are right", () => {
  const auctions = markupOf(body(get(createAuctionState(), "sch/i.html", "_nkw=kestrel+35&LH_Auction=1")));
  const conditionLinks = [...auctions.matchAll(/href="([^"]*LH_ItemCondition[^"]*)"/gu)].map((match) => match[1]!);
  assert.ok(conditionLinks.length >= 3);
  assert.ok(conditionLinks.every((href) => !href.includes("LH_Auction")));
  const whole = body(get(createAuctionState(), "sch/i.html", "_nkw=kestrel+35&_pgn=2"));
  const second = whole.slice(whole.indexOf(`aria-label="Results pagination"`));
  const next = /href="([^"]+)" aria-label="Go to next search page"/u.exec(second)?.[1] ?? "";
  assert.match(next, /_pgn=2/u);
  assert.match(second, /href="[^"]*_pgn=3[^"]*">3<\/a>/u);
});

test("the fourth results page of a session is sent to the bot check, which then lets the visitor through", () => {
  let state = createAuctionState();
  for (let view = 0; view < 3; view += 1) {
    const response = get(state, "sch/i.html", "_nkw=kestrel+35");
    assert.equal(response?.status, 200);
    state = scenario.mutate(state, response!.mutation!.operation, response!.mutation!.payload);
  }
  const stopped = get(state, "sch/i.html", "_nkw=kestrel+35&LH_Auction=1");
  assert.equal(stopped?.status, 302);
  assert.match(stopped?.headers?.location ?? "", /splashui\/challenge\?ru=%2Fscenarios%2Fauction-marketplace%2Fsch%2Fi\.html/u);
  assert.match(body(get(state, "splashui/challenge", "ru=/scenarios/auction-marketplace/sch/i.html?_nkw=x")), /Continue/u);
  assert.match(body(get(state, "splashui/challenge", "ru=https://elsewhere.example/")), /const returnTo = "\/scenarios\/auction-marketplace\/"/u);
  state = scenario.mutate(state, "pass-challenge", {});
  assert.equal(get(state, "sch/i.html", "_nkw=kestrel+35&LH_Auction=1")?.status, 200);
});

test("class names follow the lab seed, card ids change on every results page, and the text does not", () => {
  const state = createAuctionState();
  const one = markupOf(scenario.render(state, context));
  const two = markupOf(scenario.render(state, { ...context, seed: 7 }));
  assert.notEqual(one, two);
  const unstyled = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/gu, "").replace(/class="[^"]*"/gu, "");
  assert.equal(unstyled(one), unstyled(two));
  const first = markupOf(body(get(state, "sch/i.html", "_nkw=kestrel+35")));
  const later = markupOf(body(get(scenario.mutate(state, "view-results", {}), "sch/i.html", "_nkw=kestrel+35")));
  const cardIds = (html: string) => [...html.matchAll(/<li class="[^"]+" id="([^"]+)" data-listingid/gu)].map((match) => match[1]);
  assert.notDeepEqual(cardIds(first), cardIds(later));
  assert.equal(first.replace(/ id="r-[^"]+"/gu, ""), later.replace(/ id="r-[^"]+"/gu, ""));
});

test("the seller's description is framed from the second origin and may only be framed by the lab", () => {
  const item = body(get(createAuctionState(), `itm/${listingByHandle("m7").id}`));
  assert.match(item, /<iframe[^>]+title="Item description from the seller" src="http:\/\/127\.0\.0\.1:9\/scenarios\/auction-marketplace\/desc\/226152268190"/u);
  const description = get(createAuctionState(), "desc/226152268190");
  assert.match(description?.headers?.["content-security-policy"] ?? "", /frame-ancestors http:\/\/127\.0\.0\.1:\*/u);
  assert.equal(get(createAuctionState(), `itm/${listingByHandle("e1").id}`), undefined, "an ended listing is gone");
});

test("the header lists are rendered from the session, so the page always agrees with the state", () => {
  const bid = applyAuctionMutation(createAuctionState(), "place-bid", { itemId: listingByHandle("m7").id, amount: "85", reference: "" }, 0);
  const fragment = body(get(bid, "fragments/header"));
  assert.match(fragment, /Your max bid £85\.00 · Highest bidder at £84\.00/u);
  assert.match(body(get(bid, `itm/${listingByHandle("m7").id}`)), /Current bid:<\/div><div class="[^"]+">£84\.00</u);
});

test("the live tasks name this scenario's datasets and variants, and the repair task names the redesigned row", () => {
  const ids = AUCTION_MARKETPLACE_LIVE_TASKS.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith("auction-marketplace-")));
  assert.deepEqual(AUCTION_MARKETPLACE_LIVE_TASKS.map(({ judgeBy }) => judgeBy).sort(), ["expected-dataset", "expected-dataset", "expected-dataset", "expected-dataset", "playback-goal"]);
  for (const task of AUCTION_MARKETPLACE_LIVE_TASKS.filter(({ variantId }) => variantId !== undefined)) {
    assert.equal(task.variantArmedAfterBuild, true, `${task.id} is the existing-Flow entry point`);
    assert.ok(manifest.workflows!.some((workflow) => (workflow.variants ?? []).some(({ id }) => id === task.variantId)));
  }
  const [repair] = AUCTION_MARKETPLACE_REPAIR_TASKS;
  assert.equal(AUCTION_MARKETPLACE_REPAIR_TASKS.length, 1);
  assert.deepEqual({ workflowId: repair!.workflowId, variantId: repair!.variantId, expect: repair!.expect }, { workflowId: "watch-endings", variantId: "watch-redesign", expect: "repair" });
});
