import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { ADVERTS, composeFeed, listingByKey, matchingListings, type FeedQuery } from "../../catalog/index.js";
import { LOCAL_CLASSIFIEDS_LIVE_TASKS } from "../../live-tasks.js";
import { localClassifiedsManifest as manifest } from "../../manifest.js";
import { accountPage, pageBuild } from "../../pages/index.js";
import { createClassifiedsState, mutateClassifiedsState } from "../../state.js";
import type { ClassifiedsState } from "../../types.js";
import {
  accountContactsFacts, ALEX_FIGURE, budgetBikeRecords, BUDGET_BIKE_QUERY, cardRecords, furnitureRecords, FURNITURE_QUERY, PRICE_CHECK_LIMIT, PRICE_CHECK_LISTING_KEY,
  PRICE_CHECK_OFFER, priceCheckRecords, ROAD_QUERY, TEST_RIDE_LISTING_KEY, TEST_RIDE_MESSAGE, testRideRecords,
} from "../index.js";

const ID = (key: string) => listingByKey(key).id;
const titles = (records: ReadonlyArray<Record<string, string>>) => records.map(({ price, title, location }) => `${price} ${title} | ${location}`);
const workflow = (workflowId: string) => resolveScenarioWorkflow(manifest, { workflowId });
const finalFact = (workflowId: string) => workflow(workflowId).expected.finalState![0]!.value;
const apply = (state: ClassifiedsState, operation: string, payload: Record<string, unknown>, at = 0) => mutateClassifiedsState(state, operation, payload, at);

/** What a person keeps from a feed: listings only, each once, in the order the feed sent them. */
function honestRead(query: FeedQuery, seed: number): string[] {
  const seen = new Set<string>();
  return composeFeed(query, seed).entries.flatMap((entry) => (entry.kind === "listing" && !seen.has(entry.listing.id) && seen.add(entry.listing.id) ? [entry.listing.title] : []));
}

test("the four answers are pinned to literal listings, so a catalog edit cannot quietly move one", () => {
  assert.deepEqual(titles(furnitureRecords()), [
    "£28 Dining table legs x4, hairpin, 71cm | Kelford Harbour",
    "£25 Coffee table, walnut effect | Kelford Centre",
    "£45 Round pine dining table, 90cm | Upper Kelford",
    "£95 Dining table, industrial style, 160cm | Saltmarsh Row",
    "£60 Glass dining table with chrome legs | Kelford Harbour",
    "£70 Chest of drawers, white, 5 drawers | Kelford Harbour",
    "£40 Set of 4 dining chairs, match any dining table | Kelford Harbour",
  ]);
  assert.deepEqual(titles(budgetBikeRecords()), [
    "£35 Kids' balance bike, 12in | Kelford Harbour",
    "£45 Kids' bike, 16in, with stabilisers | Saltmarsh Row",
    "£90 BMX, 20in, pegs included | Kelford Centre",
    "£95 Folding bike, 20in, alloy frame | Brackwater",
    "£100 Kids' mountain bike, 24in wheels | Ashby Moor",
    "£120 Folding commuter bike with rack | Kelford Harbour",
    "£135 Hybrid bike, women's 17in frame, 21 gears | Brackwater",
    "£150 Cruiser bike with basket, mint green | Kelford Harbour",
    "£165 Folding bike, 16in wheels, 6-speed, barely used | Upper Kelford",
    "£190 Single-speed town bike, 54cm | Kelford Centre",
  ]);
  for (const record of [...furnitureRecords(), ...budgetBikeRecords()]) assert.match(record.url!, /^\/scenarios\/local-classifieds\/item\/10\d{14}\/$/u);
  assert.deepEqual(testRideRecords(), [{ title: "Road bike, 56cm aluminium frame, 16-speed", price: "£285", seller: "Tomasz Wrona" }]);
  assert.deepEqual(priceCheckRecords(), [{ title: "Carbon road bike, 58cm, 22-speed", price: "£395", condition: "Used – like new" }]);
});

test("on every seed both feeds hide the same answer among adverts, a repeated card and results outside the search, across more than one batch", () => {
  for (const [query, answer] of [[FURNITURE_QUERY, furnitureRecords()], [BUDGET_BIKE_QUERY, budgetBikeRecords()]] as const) {
    const owed = answer.map(({ title }) => title);
    for (let seed = 0; seed < 60; seed += 1) {
      const feed = composeFeed(query, seed);
      assert.deepEqual(honestRead(query, seed), owed, `seed ${seed}`);
      assert.ok(feed.entries.filter(({ kind }) => kind === "advert").length >= 1, `seed ${seed}: an advert among the listings`);
      assert.equal(feed.entries.filter(({ kind }) => kind === "listing").length, owed.length + 1, `seed ${seed}: one listing sent twice`);
      assert.ok(feed.batchCount >= 2 && feed.failingBatch !== null, `seed ${seed}: the answer spans batches, one of which fails once`);
      assert.ok(feed.outside.length > 0 && feed.outside.every(({ title }) => !owed.includes(title)), `seed ${seed}: outside results are not the answer`);
    }
  }
  // Both furniture adverts break the £100 limit they ignore.
  assert.ok(ADVERTS.filter(({ categories }) => categories.includes("furniture")).every(({ price }) => price > 100));
});

test("each plausible wrong reading of a task gives a different table", () => {
  assert.notDeepEqual(cardRecords({ ...FURNITURE_QUERY, maxPrice: null }), furnitureRecords(), "the furniture list without its price limit");
  assert.notDeepEqual(cardRecords({ ...FURNITURE_QUERY, radius: 20 }), furnitureRecords(), "the furniture list at the default radius");
  // The buyer's own "Would you take £180?" sits in Alex's thread beside his £200.
  assert.notDeepEqual(cardRecords({ ...BUDGET_BIKE_QUERY, maxPrice: 180 }), budgetBikeRecords(), "the buyer's figure, not Alex's");
  assert.notDeepEqual(cardRecords({ ...BUDGET_BIKE_QUERY, conditions: [] }), budgetBikeRecords(), "every condition, fair and free included");
  // Both instructions name the category, because the bare word reads wider or narrower than the site's category does.
  const bikeWordSearch = cardRecords({ ...BUDGET_BIKE_QUERY, surface: "search", category: null, text: "bike" }).map(({ title }) => title);
  assert.ok(["Exercise bike, magnetic resistance", "Bike helmet, adult M, 55-59cm", "Bike rack for car, carries 3 bikes"].every((title) => bikeWordSearch.includes(title)), "a search for bike finds the exercise bike, the helmet and the rack");
  assert.ok(furnitureRecords().some(({ title }) => title === "Dining table legs x4, hairpin, 71cm"), "the Furniture category holds the table legs, which 'a piece of furniture' could leave out");
  for (const id of ["local-classifieds-nearby-furniture", "local-classifieds-bikes-within-alex-price"]) {
    assert.match(LOCAL_CLASSIFIEDS_LIVE_TASKS.find((task) => task.id === id)!.instruction, /every listing in the (?:Furniture|Bicycles) category/u, id);
  }
  // The road bike to message is the cheapest only once both radius and condition are applied.
  assert.equal(matchingListings(ROAD_QUERY)[0]!.key, TEST_RIDE_LISTING_KEY);
  assert.equal(matchingListings({ ...ROAD_QUERY, radius: 20 })[0]!.key, "road-50");
  assert.equal(matchingListings({ ...ROAD_QUERY, conditions: [] })[0]!.key, "vintage-road");
  // The price check's condition does not hold: the current price, not the one struck through, is over the limit.
  const carbon = listingByKey(PRICE_CHECK_LISTING_KEY);
  assert.ok(carbon.price > PRICE_CHECK_LIMIT && (carbon.was ?? 0) > carbon.price && PRICE_CHECK_OFFER < PRICE_CHECK_LIMIT);
});

test("the account fact starts untouched, and each wrong lasting act leaves it different from the task's oracle", () => {
  const fresh = createClassifiedsState();
  assert.equal(accountContactsFacts(fresh), JSON.stringify({ saved: ["1057533328723847", "1030986358004719"], hidden: [], offers: [], messages: [] }));
  for (const id of ["furniture-nearby", "carbon-price-check", "alex-budget-bikes"]) assert.equal(finalFact(id), accountContactsFacts(fresh), id);

  const asked = apply(fresh, "send-message", { listingId: ID(TEST_RIDE_LISTING_KEY), text: TEST_RIDE_MESSAGE });
  assert.equal(finalFact("test-ride-question"), accountContactsFacts(asked));
  const wrong: Array<[string, ClassifiedsState]> = [
    ["the ready-made message", apply(fresh, "send-message", { listingId: ID(TEST_RIDE_LISTING_KEY), text: "Hi, is this still available?" })],
    ["the wrong road bike", apply(fresh, "send-message", { listingId: ID("vintage-road"), text: TEST_RIDE_MESSAGE })],
    ["the honeypot filled", apply(fresh, "send-message", { listingId: ID(TEST_RIDE_LISTING_KEY), text: TEST_RIDE_MESSAGE, website: "kerbfind.example" })],
    ["an offer as well", apply(asked, "send-offer", { listingId: ID(TEST_RIDE_LISTING_KEY), amount: 250 }, 60_000)],
    ["the listing saved as well", apply(asked, "save", { listingId: ID(TEST_RIDE_LISTING_KEY), saved: true })],
  ];
  for (const [label, state] of wrong) assert.notEqual(accountContactsFacts(state), finalFact("test-ride-question"), label);

  // The offer the condition forbids, and a reply to Alex, each break the untouched account.
  assert.notEqual(accountContactsFacts(apply(fresh, "send-offer", { listingId: ID(PRICE_CHECK_LISTING_KEY), amount: PRICE_CHECK_OFFER })), finalFact("carbon-price-check"));
  assert.notEqual(accountContactsFacts(apply(fresh, "send-message", { listingId: ID("road-52-alex"), text: "Thanks Alex" })), finalFact("alex-budget-bikes"));
});

test("every page carries the account fact, and the Buying page states Alex's figure beside the buyer's own", () => {
  const html = accountPage(pageBuild(44, "unit-run-token"), createClassifiedsState(), "buying");
  assert.ok(html.includes(`data-testid="classifieds-account-contacts">${accountContactsFacts(createClassifiedsState())}</script>`));
  assert.ok(html.includes(`I could do £${ALEX_FIGURE} if you collect this week`));
});

test("the four tasks point at the four workflows' datasets, and only the message declares where it asks", () => {
  const byId = new Map(LOCAL_CLASSIFIEDS_LIVE_TASKS.map((task) => [task.id, task]));
  const pairs = [
    ["local-classifieds-nearby-furniture", "furniture-nearby", "extract-nearby-furniture"],
    ["local-classifieds-test-ride-question", "test-ride-question", "extract-test-ride-listing"],
    ["local-classifieds-carbon-price-check", "carbon-price-check", "extract-price-check"],
    ["local-classifieds-bikes-within-alex-price", "alex-budget-bikes", "extract-budget-bikes"],
  ] as const;
  for (const [taskId, workflowId, step] of pairs) {
    const task = byId.get(taskId)!;
    assert.equal(task.expectedDatasetId, step, taskId);
    assert.equal(task.variantId, undefined, taskId);
    assert.deepEqual(workflow(workflowId).expected.extracted?.map((entry) => entry.step), [step], taskId);
    assert.ok(task.instruction.includes(TEST_RIDE_MESSAGE) === (taskId === "local-classifieds-test-ride-question"), taskId);
  }
  assert.deepEqual(byId.get("local-classifieds-test-ride-question")!.permissionPoint, { consequence: "send_or_publish", control: "Send" });
  for (const taskId of ["local-classifieds-nearby-furniture", "local-classifieds-carbon-price-check", "local-classifieds-bikes-within-alex-price"]) assert.equal(byId.get(taskId)!.permissionPoint, undefined, taskId);
});
