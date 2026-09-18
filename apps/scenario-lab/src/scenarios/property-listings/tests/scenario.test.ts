import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { councilTaxBand, listingPath } from "../format.js";
import { propertyListings, PROPERTY_COUNT } from "../listings.js";
import { propertyListingsScenario as scenario } from "../scenario.js";
import { allMatchingProperties, defaultPropertySearch, PROPERTY_PAGE_SIZE, searchProperties } from "../search.js";
import type { PropertyListingsState, PropertySearch, PropertyVariant } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "property-listings-unit-token", seed: 161 };
const search = (overrides: Partial<PropertySearch> = {}): PropertySearch => ({ ...defaultPropertySearch(), ...overrides });
const apply = (state: PropertyListingsState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "baseline"}`;
const count = (html: string, needle: string) => html.split(needle).length - 1;
const bodyOf = (html: string) => html.slice(0, html.indexOf("<script"));
const armed = (variant: PropertyVariant) => ({ operation: "set-variant", payload: { variant } });

function route(state: PropertyListingsState, subpath: string, query = "", method: "GET" | "HEAD" = "GET") {
  const handler = scenario.route;
  assert.ok(handler);
  return handler(state, { subpath, query: new URLSearchParams(query), method }, context);
}

function renderArmed(variant: PropertyVariant): string {
  return scenario.render(apply(scenario.createState(161), "set-variant", { variant }), context);
}

/** The primary workflow and every `workflows[]` entry, each bare and under each of its variants. */
function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

function datasetsOf(selection: Selection) {
  return resolveScenarioWorkflow(manifest, selection).expected.extracted ?? [];
}

test("the manifest is a valid scenario declaring six workflows, three variants and a playback goal", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["area-search", "no-matches", "cheapest-match", "listing-detail", "detail-sweep"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [{ id: "agent-withheld", arm: armed("agent-withheld") }],
    [{ id: "renamed-pagination", arm: armed("renamed-pagination") }],
    [],
    [],
    [{ id: "redesigned-search", arm: armed("redesigned-search") }],
    [],
  ]);
  assert.equal(selections().length, 9);
  assert.equal(manifest.playbackGoal?.id, "last-page-of-kelford-three-beds");
  assert.deepEqual(manifest.playbackGoal?.successFacts.map(({ value }) => value), ["Filters: Kelford \u00b7 3 bedrooms", "Page 2 of 2", false]);
});

test("every workflow is judged: each declares a dataset per extract step, and a final state to check it against", () => {
  for (const selection of selections()) {
    const { expected, recordingScript } = resolveScenarioWorkflow(manifest, selection);
    const extractSteps = recordingScript.filter(({ operation }) => operation === "extract");
    assert.ok(extractSteps.length > 0, label(selection));
    assert.deepEqual(datasetsOf(selection).map(({ step }) => step), extractSteps.map(({ id }) => id), label(selection));
    for (const dataset of datasetsOf(selection)) assert.equal(dataset.records?.length, dataset.count, `${label(selection)} ${dataset.step}`);
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
    assert.equal(expected.failure, undefined, `${label(selection)} must be a workflow the product can pass`);
  }
});

test("no workflow is judged on refusing: every dataset but the empty search expects records", () => {
  const empty = datasetsOf({ workflowId: "no-matches" });
  assert.deepEqual(empty.map(({ count: records }) => records), [0]);
  const others = selections().filter(({ workflowId }) => workflowId !== "no-matches").flatMap(datasetsOf);
  assert.ok(others.length >= 8);
  assert.ok(others.every(({ count: records }) => (records ?? 0) > 0), "a scraping corpus must not pass by collecting nothing");
});

test("the market is identical for every seed and shaped for the questions the workflows ask", () => {
  assert.equal(propertyListings.length, PROPERTY_COUNT);
  assert.equal(new Set(propertyListings.map(({ reference }) => reference)).size, PROPERTY_COUNT);
  assert.equal(new Set(propertyListings.map(({ slug }) => slug)).size, PROPERTY_COUNT);

  // A five-bedroom home starts above 430,000 everywhere, so the lowest band
  // and five bedrooms together are a search with no answer at all.
  assert.deepEqual(allMatchingProperties(search({ beds: "5", band: "up-to-250000" })), []);
  assert.ok(propertyListings.filter(({ bedrooms }) => bedrooms >= 5).length > 30);
  assert.ok(Math.min(...propertyListings.filter(({ bedrooms }) => bedrooms >= 5).map(({ priceGbp }) => priceGbp)) > 250_000);

  // Homes without a published floor area, and new builds without a council tax
  // band, are both a normal part of the market rather than a rare edge.
  const withoutFloorArea = propertyListings.filter(({ floorAreaSqFt }) => floorAreaSqFt === undefined);
  assert.ok(withoutFloorArea.length >= 20 && withoutFloorArea.length <= 60, String(withoutFloorArea.length));
  assert.ok(propertyListings.filter((listing) => councilTaxBand(listing) === undefined).length >= 20);
  assert.equal(propertyListings.every((listing) => listing.newBuild === (councilTaxBand(listing) === undefined)), true);

  // Every facet has to be worth setting, and the area sweep has to be several pages long.
  assert.equal(searchProperties(defaultPropertySearch()).pageCount, Math.ceil(PROPERTY_COUNT / PROPERTY_PAGE_SIZE));
  assert.ok(allMatchingProperties(search({ area: "kelford" })).length > 4 * PROPERTY_PAGE_SIZE);
  assert.ok(allMatchingProperties(search({ area: "kelford", beds: "3" })).length > PROPERTY_PAGE_SIZE);
  for (const band of ["up-to-250000", "250000-500000", "500000-750000", "750000-plus"]) {
    assert.ok(allMatchingProperties(search({ band })).length > 0, band);
  }
  const initial = scenario.createState(scenario.seed);
  assert.deepEqual(scenario.createState(1), initial);
  assert.deepEqual(scenario.createState(9_999), initial);
  assert.deepEqual(initial.oracle, { matchCount: PROPERTY_COUNT, pageCount: 29, references: searchProperties(defaultPropertySearch()).items.map(({ reference }) => reference) });
});

test("expected records are what each workflow reads, with literal spot checks of the page's own formatting", () => {
  const openingPage = searchProperties(defaultPropertySearch()).items;
  const firstPage = datasetsOf({})[0];
  assert.equal(firstPage?.count, PROPERTY_PAGE_SIZE);
  assert.deepEqual(firstPage?.records?.map((record) => record.address), openingPage.map(({ address }) => address));
  assert.deepEqual(firstPage?.records?.[0], {
    price: "\u00a3340,000",
    address: "Flat 5, 37 Saltmarsh Crescent, Ashcombe",
    bedrooms: "2 bedrooms",
    floorArea: "1,095 sq ft",
    agent: "Ashdown & Vale",
    listed: "Today",
  });
  // A home whose agent published no floor area reads as no value, never as "".
  assert.equal(firstPage?.records?.filter((record) => record.floorArea === null).length, 3);
  assert.equal(firstPage?.records?.some((record) => Object.values(record).includes("")), false);
  assert.deepEqual(firstPage?.optionalFields, ["floorArea"]);

  // The withheld rendering changes the agent and nothing else about a card.
  const withheld = datasetsOf({ variantId: "agent-withheld" })[0];
  assert.equal(withheld?.records?.filter((record) => record.agent === null).length, 1);
  assert.deepEqual(
    withheld?.records?.map(({ agent: _agent, ...rest }) => rest),
    firstPage?.records?.map(({ agent: _agent, ...rest }) => rest),
  );

  // The area sweep is the whole of Kelford, in the page's order, over every page.
  const kelford = allMatchingProperties(search({ area: "kelford" }));
  const sweep = datasetsOf({ workflowId: "area-search" })[0];
  assert.equal(sweep?.count, kelford.length);
  assert.equal(sweep?.pages, Math.ceil(kelford.length / PROPERTY_PAGE_SIZE));
  assert.ok((sweep?.pages ?? 0) >= 6, "following pagination to its end must take several pages");
  assert.deepEqual(sweep?.records?.map((record) => record.address), kelford.map(({ address }) => address));

  // The cheapest three-bedroom home in Kelford, and the facts only its own page carries.
  const cheapest = allMatchingProperties(search({ area: "kelford", beds: "3", sort: "price-asc" }))[0];
  assert.ok(cheapest);
  assert.deepEqual(datasetsOf({ workflowId: "cheapest-match" })[0]?.records?.map((record) => record.address), [cheapest.address]);
  assert.deepEqual(datasetsOf({ workflowId: "listing-detail" })[0]?.records, [{
    address: cheapest.address,
    price: `\u00a3${cheapest.priceGbp.toLocaleString("en-US")}`,
    tenure: cheapest.tenure,
    councilTax: councilTaxBand(cheapest) ?? null,
    epc: cheapest.epcRating,
  }]);

  // The per-row sweep reads one home per page visit, and the third of them is
  // a new build whose council tax band the page does not have.
  const swept = datasetsOf({ workflowId: "detail-sweep" });
  assert.equal(swept.length, 3);
  assert.deepEqual(swept.map((dataset) => dataset.records?.[0]?.address), openingPage.slice(0, 3).map(({ address }) => address));
  assert.deepEqual(swept.map((dataset) => dataset.records?.[0]?.councilTax), ["Band C", "Band F", null]);
  assert.ok(swept.every((dataset) => dataset.optionalFields?.includes("councilTax")));
});

test("show records each served search, clamps pages, refuses values the selects do not offer, and ignores bad payloads", () => {
  const initial = scenario.createState(161);
  const second = apply(initial, "show", { page: 2, sort: "recent" });
  assert.equal(second.search.page, 2);
  assert.deepEqual(second.searchHistory, [second.search]);
  assert.equal(apply(initial, "show", { page: 999 }).search.page, 29);
  for (const page of [0, -1, 1.5, "2", null]) assert.equal(apply(initial, "show", { page }).search.page, 1, String(page));
  const narrowed = apply(initial, "show", { area: "kelford", beds: "3", sort: "price-asc" });
  assert.equal(narrowed.oracle.matchCount, allMatchingProperties(search({ area: "kelford", beds: "3" })).length);
  assert.equal(narrowed.oracle.pageCount, 2);
  // Anything the selects do not offer is read as "any", never passed through.
  const forged = apply(initial, "show", { area: "atlantis", beds: "99", band: "free", sort: "random", newThisWeek: "yes" });
  assert.deepEqual(forged.search, defaultPropertySearch());
  assert.equal(apply(initial, "show", { newThisWeek: true }).oracle.matchCount, allMatchingProperties(search({ newThisWeek: true })).length);
  for (const payload of [null, "page", 3, ["page"]]) assert.equal(apply(initial, "show", payload), initial);
  assert.equal(apply(initial, "unknown-operation", { page: 2 }), initial);
  let busy = initial;
  for (let index = 0; index < 60; index += 1) busy = apply(busy, "show", { page: (index % 3) + 1 });
  assert.equal(busy.searchHistory.length, 50);
});

test("set-variant arms each rendering from the opening search, and view-listing records only real homes", () => {
  const initial = scenario.createState(161);
  const browsing = apply(initial, "show", { page: 4, area: "kelford" });
  for (const variant of ["agent-withheld", "renamed-pagination", "redesigned-search"] as const) {
    const state = apply(browsing, "set-variant", { variant });
    assert.equal(state.variant, variant, variant);
    assert.deepEqual(state.search, defaultPropertySearch(), variant);
    assert.deepEqual(state.oracle, initial.oracle, variant);
  }
  assert.deepEqual(apply(apply(initial, "set-variant", { variant: "agent-withheld" }), "set-variant", { variant: "baseline" }), initial);
  for (const payload of [{ variant: "bogus" }, {}, null]) assert.equal(apply(initial, "set-variant", payload), initial);

  const opened = apply(initial, "view-listing", { slug: propertyListings[0]?.slug });
  assert.deepEqual(opened.listingViews, [propertyListings[0]?.slug]);
  for (const payload of [{ slug: "hb-00000" }, { slug: 7 }, {}]) assert.equal(apply(initial, "view-listing", payload), initial);
});

test("the search page opens on the newest homes, with the facets, the counter and a Next control, and no run token", () => {
  const initial = scenario.createState(161);
  const html = scenario.render(initial, context);
  const body = bodyOf(html);
  assert.match(body, /<h1>Homes for sale<\/h1>/);
  for (const testId of ["search-form", "area-filter", "beds-filter", "band-filter", "sort-order", "new-this-week", "search-submit", "results", "results-list", "result-count", "page-status", "next-page"]) {
    assert.equal(count(body, `data-testid="${testId}"`), 1, testId);
  }
  assert.equal(count(body, '<li class="result"'), PROPERTY_PAGE_SIZE);
  assert.match(body, /<p class="result-count" data-testid="result-count" role="status">288 homes for sale<\/p>/);
  assert.match(body, /<p class="page-status" data-testid="page-status">Page 1 of 29<\/p>/);
  assert.equal(count(body, "data-testid=\"filter-summary\""), 0, "the opening search applies no facet, so it shows no filter line");
  assert.equal(html.includes(context.runToken), false);

  // Nothing on a card is reachable by a test hook: the price, the address, the
  // bedrooms, the floor area, the agent and the age are visible text.
  const card = body.slice(body.indexOf('<li class="result"'), body.indexOf("</li>") + 5);
  assert.equal(card.includes("data-testid"), false);
  assert.match(card, /<p class="price">\u00a3340,000<\/p>/);
  assert.match(card, /<a class="listing-link" href="\/scenarios\/property-listings\/listings\/hb-10258">Flat 5, 37 Saltmarsh Crescent, Ashcombe<\/a>/);
  assert.match(card, /<span class="beds">2 bedrooms<\/span>/);
  assert.match(card, /<span class="floor-area">1,095 sq ft<\/span>/);
  assert.match(card, /<span class="label">Agent<\/span> <span class="agent-name">Ashdown &amp; Vale<\/span>/);
  assert.match(card, /<span class="label">Listed<\/span> <span class="listed-on">Today<\/span>/);

  // The start page always opens on the portal's own first page, whatever the run last looked at.
  assert.equal(scenario.render(apply(initial, "show", { page: 12, area: "kelford" }), context), html);
});

test("a home with no published floor area has no element for it, so the field reads as no value", () => {
  const body = bodyOf(scenario.render(scenario.createState(161), context));
  const cards = body.split('<li class="result"').slice(1);
  assert.equal(cards.length, PROPERTY_PAGE_SIZE);
  assert.equal(cards.filter((card) => card.includes('class="floor-area"')).length, PROPERTY_PAGE_SIZE - 3);
  assert.equal(body.includes('class="floor-area"></span>'), false, "the element is absent, never present and empty");
});

test("the results route serves each page of a search and records it, and answers an impossible search with nothing", () => {
  const initial = scenario.createState(161);
  const first = route(initial, "results");
  assert.equal(first?.status, 200);
  assert.equal(count(first?.body ?? "", '<li class="result"'), PROPERTY_PAGE_SIZE);
  assert.deepEqual(first?.mutation, { operation: "show", payload: defaultPropertySearch() });

  const kelford = allMatchingProperties(search({ area: "kelford" }));
  const lastPage = route(initial, "results", "area=kelford&page=6");
  assert.equal(count(lastPage?.body ?? "", '<li class="result"'), kelford.length - 5 * PROPERTY_PAGE_SIZE);
  assert.equal(count(lastPage?.body ?? "", 'data-testid="next-page"'), 0, "the last page offers no way on");
  assert.match(lastPage?.body ?? "", /Page 6 of 6/);
  assert.match(lastPage?.body ?? "", /<p class="filter-summary" data-testid="filter-summary">Filters: Kelford<\/p>/);

  const nothing = route(initial, "results", "beds=5&band=up-to-250000")?.body ?? "";
  assert.match(nothing, />0 homes for sale</);
  assert.match(nothing, /<p class="no-results" data-testid="empty-results">No homes match this search\./);
  assert.equal(count(nothing, "results-list") + count(nothing, 'data-testid="pagination"'), 0);
  assert.match(nothing, /Filters: 5 or more bedrooms \u00b7 Up to \u00a3250,000/);

  assert.deepEqual(route(initial, "results", "page=abc")?.mutation?.payload, defaultPropertySearch());
  assert.deepEqual(route(initial, "results", "page=2", "HEAD"), route(initial, "results", "page=2"));
  let walked = initial;
  for (const page of [2, 3]) {
    const response = route(walked, "results", `area=kelford&page=${page}`);
    assert.ok(response?.mutation);
    walked = apply(walked, response.mutation.operation, response.mutation.payload);
  }
  assert.deepEqual(walked.searchHistory.map(({ page }) => page), [2, 3]);
  assert.equal(walked.oracle.matchCount, kelford.length);
});

test("a home's own page carries the three facts no card shows, records the visit, and 404s everything else", () => {
  const initial = scenario.createState(161);
  const listing = propertyListings.find((candidate) => !candidate.newBuild);
  assert.ok(listing);
  const response = route(initial, `listings/${listing.slug}`);
  assert.equal(response?.status, 200);
  assert.deepEqual(response?.mutation, { operation: "view-listing", payload: { slug: listing.slug } });
  const body = response?.body ?? "";
  assert.match(body, /<dt>Tenure<\/dt><dd class="tenure">(Freehold|Leasehold)<\/dd>/);
  assert.match(body, new RegExp(`<dt>Council tax</dt><dd class="council-tax">${councilTaxBand(listing)}</dd>`));
  assert.match(body, new RegExp(`<dt>EPC rating</dt><dd class="epc">${listing.epcRating}</dd>`));
  assert.match(body, /data-testid="back-to-results" href="\/scenarios\/property-listings\/"/);
  assert.equal(listingPath(listing), `/scenarios/property-listings/listings/${listing.slug}`);

  // A new build has no band yet, so the row is absent rather than empty.
  const newBuild = propertyListings.find((candidate) => candidate.newBuild);
  assert.ok(newBuild);
  const newBuildBody = route(initial, `listings/${newBuild.slug}`)?.body ?? "";
  assert.equal(newBuildBody.includes("council-tax"), false);
  assert.equal(newBuildBody.includes("<dt>Council tax</dt>"), false);
  assert.match(newBuildBody, /<dd class="tenure">/);

  for (const subpath of ["listings/hb-00000", "listings/", "listings/HB-10258", "results/extra", "unknown"]) {
    assert.equal(route(initial, subpath), undefined, subpath);
  }
});

/**
 * Each armed rendering is a control for one property of the page, so these
 * assertions are written against the served markup: a rendering that changed
 * anything else would show up here rather than hide behind a record
 * comparison that happens to still match.
 */
test("each armed rendering changes one thing and leaves the rest of the page alone", () => {
  const baseline = bodyOf(scenario.render(scenario.createState(161), context));

  const withheld = bodyOf(renderArmed("agent-withheld"));
  assert.equal(count(baseline, 'class="agent-name"'), PROPERTY_PAGE_SIZE);
  assert.equal(count(withheld, 'class="agent-name"'), PROPERTY_PAGE_SIZE - 1);
  assert.equal(count(withheld, '<li class="result"'), PROPERTY_PAGE_SIZE, "the cards are all still there; one of them names no agent");
  assert.equal(withheld.includes('class="agent-name"></span>'), false, "the line is absent, never present and empty");
  assert.equal(count(withheld, 'class="price"'), count(baseline, 'class="price"'));

  const renamed = bodyOf(renderArmed("renamed-pagination"));
  assert.match(renamed, /<a data-testid="next-page" data-page="2" href="\?page=2">More homes<\/a>/);
  assert.equal(count(renamed, '<button type="button" data-testid="next-page"'), 0);
  assert.equal(count(baseline, '<button type="button" data-testid="next-page"'), 1);
  assert.match(renamed, /<p class="page-status" data-testid="page-status">Showing page 1 of 29<\/p>/);
  assert.equal(count(renamed, '<li class="result"'), PROPERTY_PAGE_SIZE);

  const redesigned = bodyOf(renderArmed("redesigned-search"));
  assert.equal(redesigned.includes('data-testid="search-submit"'), false, "the recorded press has nothing to land on");
  assert.match(redesigned, /<button type="submit" data-testid="apply-filters">Show homes<\/button>/);
  assert.equal(count(redesigned, '<li class="result"'), PROPERTY_PAGE_SIZE, "only the button moved; the search itself is unchanged");
  assert.equal(count(redesigned, 'data-testid="area-filter"'), 1);
});
