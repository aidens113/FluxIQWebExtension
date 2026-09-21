import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { composeFeed, FEED_BATCH_SIZE, LISTINGS, listingByKey, matchingListings } from "../catalog/index.js";
import { bikeRecords, savedRecords } from "../answers.js";
import { LOCAL_CLASSIFIEDS_LIVE_TASKS } from "../live-tasks.js";
import { LOCAL_CLASSIFIEDS_REPAIR_TASKS } from "../repair-tasks.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import { BIKE_QUERY, DINING_QUERY, FOLDING_QUERY, OFFER_LISTING_KEY, SAVED_TABLE_KEYS } from "../targets.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;

function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

test("the manifest is valid, with an offer, two further workflows and three variants, each judged on succeeding", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["bike-search", "save-dining-tables"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [],
    [{ id: "list-layout", arm: { operation: "set-mode", payload: { mode: "list-layout" } } }, { id: "location-check", arm: { operation: "set-mode", payload: { mode: "location-check" } } }],
    [{ id: "moved-save", arm: { operation: "set-mode", payload: { mode: "moved-save" } } }],
  ]);
  assert.equal(selections().length, 6);
  for (const selection of selections()) {
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
    assert.equal(expected.failure, undefined, `${label(selection)} must be judged on succeeding`);
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

test("the three answers are pinned to literal listings, so a catalog edit cannot quietly move one", () => {
  assert.deepEqual(bikeRecords().map(({ price, title, location }) => `${price} ${title} | ${location}`), [
    "£100 Kids' mountain bike, 24in wheels | Ashby Moor",
    "£120 Folding commuter bike with rack | Kelford Harbour",
    "£135 Hybrid bike, women's 17in frame, 21 gears | Brackwater",
    "£150 Cruiser bike with basket, mint green | Kelford Harbour",
    "£165 Folding bike, 16in wheels, 6-speed, barely used | Upper Kelford",
    "£190 Single-speed town bike, 54cm | Kelford Centre",
    "£230 Road bike, 50cm, triple chainset | Ashby Moor",
    "£240 Ridgeline 27.5in mountain bike, medium frame | Upper Kelford",
    "£285 Road bike, 56cm aluminium frame, 16-speed | Kelford Centre",
    "£375 Gravel bike, 52cm, hydraulic disc brakes | Upper Kelford",
    "£395 Carbon road bike, 58cm, 22-speed | Kelford Harbour",
    "£400 Electric bike, 250W, 40-mile range | Saltmarsh Row",
  ]);
  for (const record of bikeRecords()) assert.match(record.url!, /^\/scenarios\/local-classifieds\/item\/10\d{14}\/$/u);
  assert.deepEqual(savedRecords(), [
    { title: "Adjustable desk lamp, black", price: "£22", status: "Available" },
    { title: "Round pine dining table, 90cm", price: "£45", status: "Available" },
    { title: "Glass dining table with chrome legs", price: "£60", status: "Available" },
    { title: "Rattan armchair", price: "£65", status: "Sold" },
    { title: "Dining table, industrial style, 160cm", price: "£95", status: "Available" },
  ]);
  // The offer's listing is the cheapest real match; the advert that undercuts it is not a listing.
  assert.deepEqual(matchingListings(FOLDING_QUERY).map(({ key }) => key), [OFFER_LISTING_KEY, "e-folding"]);
  // The three tables are the cheapest dining tables in the search once legs and chairs are passed over.
  assert.deepEqual(matchingListings(DINING_QUERY).map(({ key }) => key).slice(0, 5), ["hairpin-legs", "dining-chairs", ...SAVED_TABLE_KEYS]);
});

test("listings are authored, seed-independent and carry unique sixteen-digit ids", () => {
  const ids = LISTINGS.map(({ id }) => id);
  assert.equal(new Set(ids).size, LISTINGS.length);
  for (const id of ids) assert.match(id, /^10\d{14}$/u);
  assert.deepEqual(scenario.createState(1), scenario.createState(987_654));
  assert.equal(listingByKey("ridgeline-mtb-upper").title, listingByKey("ridgeline-mtb-hallam").title, "the reseller's copy shares the title");
});

/** What a person keeps from a feed: listings only, each once, in the order the feed sent them. */
function honestRead(seed: number, query = BIKE_QUERY): string[] {
  const seen = new Set<string>();
  return composeFeed(query, seed).entries.flatMap((entry) => (entry.kind === "listing" && !seen.has(entry.listing.id) && seen.add(entry.listing.id) ? [entry.listing.title] : []));
}

test("on every seed the feed hides the same answer among adverts, a repeated card and results outside the search", () => {
  const answer = bikeRecords().map(({ title }) => title);
  const failing = new Set<number | null>();
  for (let seed = 0; seed < 60; seed += 1) {
    const feed = composeFeed(BIKE_QUERY, seed);
    assert.deepEqual(honestRead(seed), answer, `seed ${seed}`);
    const kinds = feed.entries.map((entry) => entry.kind);
    assert.equal(kinds.filter((kind) => kind === "advert").length, 2, `seed ${seed}: two adverts`);
    assert.ok(kinds.indexOf("advert") <= 1, `seed ${seed}: an advert leads the feed`);
    const listed = feed.entries.flatMap((entry) => (entry.kind === "listing" ? [entry.listing.id] : []));
    assert.equal(listed.length, answer.length + 1, `seed ${seed}: one listing is sent twice`);
    const repeatAt = listed.findIndex((id, index) => listed.indexOf(id) !== index);
    const entryIndex = feed.entries.findIndex((entry, index) => entry.kind === "listing" && index > 0 && feed.entries.slice(0, index).some((earlier) => earlier.kind === "listing" && earlier.listing.id === entry.listing.id));
    assert.ok(repeatAt > 0 && entryIndex % FEED_BATCH_SIZE === 0, `seed ${seed}: the repeat opens a batch`);
    assert.ok(feed.outside.length > 0 && feed.outside.every((listing) => !answer.includes(listing.title)), `seed ${seed}: outside results are not the answer`);
    assert.equal(feed.batchCount, 3);
    failing.add(feed.failingBatch);
  }
  assert.deepEqual([...failing].sort(), [1, 2], "the failing batch moves with the seed");
});

test("a naive read of the feed differs from the answer: it takes the adverts, the repeat and what lies outside the search", () => {
  const feed = composeFeed(BIKE_QUERY, scenario.seed);
  const everything = [...feed.entries.map((entry) => (entry.kind === "advert" ? entry.advert.title : entry.listing.title)), ...feed.outside.map(({ title }) => title)];
  const answer = bikeRecords().map(({ title }) => title);
  assert.notDeepEqual(everything, answer);
  assert.ok(everything.includes("Folding bike, 20in, 7-speed, clearance"), "the advert is read");
  assert.ok(everything.length >= answer.length + 2 + 1 + 1);
  // The offer search puts the cheaper advert first, so "the first card" is the wrong bike.
  const folding = composeFeed(FOLDING_QUERY, scenario.seed).entries[0];
  assert.equal(folding?.kind, "advert");
});

test("the task catalogs point at this scenario's declared datasets, goal and repair row", () => {
  assert.deepEqual(LOCAL_CLASSIFIEDS_LIVE_TASKS.map(({ id }) => id), [
    "local-classifieds-bike-search", "local-classifieds-bike-search-list-layout", "local-classifieds-bike-search-location-check", "local-classifieds-save-dining-tables", "local-classifieds-make-offer",
  ]);
  const datasets = new Set([manifest, ...(manifest.workflows ?? [])].flatMap((workflow) => workflow.recordingScript.filter(({ operation }) => operation === "extract").map(({ id }) => id)));
  for (const task of LOCAL_CLASSIFIEDS_LIVE_TASKS) {
    if (task.judgeBy === "expected-dataset") assert.ok(datasets.has(task.expectedDatasetId!), task.id);
    else assert.ok(manifest.playbackGoal, task.id);
  }
  const [repair] = LOCAL_CLASSIFIEDS_REPAIR_TASKS;
  const { expected, recordingScript } = resolveScenarioWorkflow(manifest, { workflowId: repair!.workflowId!, variantId: repair!.variantId! });
  assert.ok(recordingScript.some(({ target }) => target === "testid:marketplace_pdp_save"), "the recording names the control by its test id");
  assert.ok((expected.pageFacts ?? []).some(({ subject, predicate, value }) => subject === "marketplace_pdp_save" && predicate === "exists" && value === false));
});
