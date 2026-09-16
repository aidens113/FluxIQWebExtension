import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { CATALOG_ABSOLUTE_ORIGIN, CATALOG_PLACEHOLDER_SLUG, productHref, productImageAlt, productImagePath } from "../format.js";
import { listCatalog } from "../listing.js";
import { catalogProducts } from "../products.js";
import { productCatalogScenario as scenario } from "../scenario.js";
import type { CatalogVariant, CatalogView, ProductCatalogState } from "../types.js";

type Selection = { workflowId?: string; variantId?: string };

const manifest = scenario.manifest;
const context = { runToken: "product-catalog-unit-token", seed: 114 };
const view = (page: number, query = "", inStockOnly = false): CatalogView => ({ page, query, inStockOnly });
const ids = (...numbers: number[]) => numbers.map((number) => `p${String(number).padStart(2, "0")}`);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const count = (html: string, testId: string) => html.split(`data-testid="${testId}"`).length - 1;
const apply = (state: ProductCatalogState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const label = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "baseline"}`;
const records = (selection: Selection) => resolveScenarioWorkflow(manifest, selection).expected.extracted?.[0]?.records ?? [];

function route(state: ProductCatalogState, subpath: string, query = "", method: "GET" | "HEAD" = "GET") {
  const handler = scenario.route;
  assert.ok(handler);
  return handler(state, { subpath, query: new URLSearchParams(query), method }, context);
}

/** The primary workflow and every `workflows[]` entry, each bare and under each of its variants. */
function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

const armed = (variant: string) => ({ operation: "set-variant", payload: { variant } });

test("manifest declares W04-W07 as a valid primary workflow, five workflows, and their variants", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["paginated-extraction", "search", "in-stock-only", "with-images", "numbered-pages"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id, arm }) => ({ id, arm }))), [
    [{ id: "text-variant", arm: armed("text-variant") }, { id: "sparse-cards", arm: armed("sparse-cards") }, { id: "absolute-links", arm: armed("absolute-links") }],
    [{ id: "short-catalog", arm: armed("short-catalog") }, { id: "link-pagination", arm: armed("link-pagination") }],
    [{ id: "no-results", arm: armed("no-results") }],
    [],
    [{ id: "lazy-images", arm: armed("lazy-images") }],
    [],
  ]);
  assert.equal(selections().length, 13);
  for (const selection of selections()) {
    const { expected, recordingScript } = resolveScenarioWorkflow(manifest, selection);
    const extractSteps = recordingScript.filter(({ operation }) => operation === "extract");
    assert.equal(extractSteps.length, 1, label(selection));
    assert.equal(expected.extracted?.length, 1, label(selection));
    assert.equal(expected.extracted?.[0]?.step, extractSteps[0]?.id, label(selection));
    assert.equal(expected.extracted?.[0]?.records?.length, expected.extracted?.[0]?.count, label(selection));
    assert.ok((expected.finalState ?? []).length > 0, label(selection));
  }
});

test("the catalog is identical for every seed and shaped for the corpus rows", () => {
  assert.equal(catalogProducts.length, 23);
  assert.equal(new Set(catalogProducts.map(({ slug }) => slug)).size, 23);
  assert.deepEqual(catalogProducts.filter(({ inStock }) => !inStock).map(({ id }) => id), ids(3, 7, 10, 13, 19));
  assert.deepEqual(catalogProducts.filter(({ name }) => /lamp/i.test(name)).map(({ id }) => id), ids(1, 10, 18, 23));
  const initial = scenario.createState(scenario.seed);
  assert.deepEqual(initial, {
    variant: "baseline", view: view(1), oracle: { resultCount: 23, pageCount: 3, productIds: ids(...range(1, 8)) }, viewHistory: [], productViews: [],
  });
  assert.deepEqual(scenario.createState(1), initial);
  assert.deepEqual(scenario.createState(42), initial);
});

test("expected records are exactly what each workflow reads from the listing, with literal spot checks", () => {
  const runs: Array<[Selection, CatalogVariant, CatalogView, boolean]> = [
    [{}, "baseline", view(1), false],
    [{ variantId: "text-variant" }, "text-variant", view(1), false],
    [{ variantId: "sparse-cards" }, "sparse-cards", view(1), false],
    [{ variantId: "absolute-links" }, "absolute-links", view(1), false],
    [{ workflowId: "paginated-extraction" }, "baseline", view(1), true],
    [{ workflowId: "paginated-extraction", variantId: "short-catalog" }, "short-catalog", view(1), true],
    [{ workflowId: "paginated-extraction", variantId: "link-pagination" }, "link-pagination", view(1), true],
    [{ workflowId: "search" }, "baseline", view(1, "lamp"), false],
    [{ workflowId: "search", variantId: "no-results" }, "no-results", view(1, "lamp"), false],
    [{ workflowId: "in-stock-only" }, "baseline", view(1, "", true), true],
    [{ workflowId: "with-images" }, "baseline", view(1), false],
    [{ workflowId: "with-images", variantId: "lazy-images" }, "lazy-images", view(1), false],
    [{ workflowId: "numbered-pages" }, "baseline", view(1), true],
  ];
  assert.deepEqual(runs.map(([selection]) => label(selection)), selections().map(label));
  for (const [selection, variant, start, paginate] of runs) {
    const pages = paginate ? range(1, listCatalog(variant, start).pageCount) : [1];
    const items = pages.flatMap((page) => listCatalog(variant, { ...start, page }).items);
    const expected = records(selection);
    if (selection.workflowId === "with-images") {
      const deferred = variant === "lazy-images";
      assert.deepEqual(expected.map(({ image }) => image), items.map(({ slug }) => productImagePath(deferred ? CATALOG_PLACEHOLDER_SLUG : slug)), label(selection));
      assert.deepEqual(expected.map(({ deferredImage }) => deferredImage), items.map(({ slug }) => deferred ? productImagePath(slug) : null), label(selection));
      assert.deepEqual(expected.map(({ imageAlt }) => imageAlt), items.map((product) => productImageAlt(product)), label(selection));
      continue;
    }
    assert.deepEqual(expected.map(({ url }) => url), items.map((product) => productHref(product, variant)), label(selection));
  }
  const pageOne = records({});
  assert.deepEqual(pageOne[0], { name: "Aurora Desk Lamp", price: "$49.00", rating: "4.6 out of 5", url: "/scenarios/product-catalog/products/aurora-desk-lamp" });
  assert.equal(pageOne[5]?.price, "$1,249.00");
  const drifted = records({ variantId: "text-variant" });
  assert.equal(drifted[5]?.price, "1,249.00 USD");
  assert.deepEqual(drifted.map(({ price: _price, ...rest }) => rest), pageOne.map(({ price: _price, ...rest }) => rest));
  assert.ok(drifted.every((record, index) => record.price !== pageOne[index]?.price));
  assert.deepEqual(records({ workflowId: "search" }).map(({ name }) => name), ["Aurora Desk Lamp", "Juniper Floor Lamp", "Ridge Clip Lamp", "Willow Reading Lamp"]);
  const inStock = records({ workflowId: "in-stock-only" });
  assert.equal(inStock.length, 18);
  assert.ok(inStock.every(({ availability }) => availability === "In stock"));

  // A dropped field is null, never "": p03 is out of stock, p05 is rated 4.1, and p07 is both.
  const sparse = records({ variantId: "sparse-cards" });
  assert.deepEqual(sparse[2], { name: "Cobalt Ceramic Mug", price: null, rating: "4.8 out of 5", url: pageOne[2]?.url ?? "" });
  assert.deepEqual(sparse[4], { name: "Ember Scented Candle", price: "$22.00", rating: null, url: pageOne[4]?.url ?? "" });
  assert.deepEqual(sparse[6], { name: "Grove Planter Set", price: null, rating: null, url: pageOne[6]?.url ?? "" });
  assert.equal(sparse.filter(({ price }) => price === null).length, 2);
  assert.equal(sparse.filter(({ rating }) => rating === null).length, 2);
  assert.equal(sparse.some((record) => Object.values(record).includes("")), false);

  // Only the link text moves; every other field stays exactly as the baseline reads it.
  const absolute = records({ variantId: "absolute-links" });
  assert.equal(absolute[0]?.url, `${CATALOG_ABSOLUTE_ORIGIN}/scenarios/product-catalog/products/aurora-desk-lamp`);
  assert.ok(absolute.every(({ url }) => url?.startsWith(CATALOG_ABSOLUTE_ORIGIN)));
  assert.deepEqual(absolute.map(({ url: _url, ...rest }) => rest), pageOne.map(({ url: _url, ...rest }) => rest));

  const eager = records({ workflowId: "with-images" });
  assert.deepEqual(eager[0], {
    name: "Aurora Desk Lamp",
    image: "/scenarios/product-catalog/images/aurora-desk-lamp.svg",
    imageAlt: "Aurora Desk Lamp product photo",
    deferredImage: null,
  });
  assert.ok(eager.every(({ deferredImage }) => deferredImage === null));
  const deferred = records({ workflowId: "with-images", variantId: "lazy-images" });
  assert.equal(deferred[0]?.image, "/scenarios/product-catalog/images/placeholder.svg");
  assert.equal(deferred[0]?.deferredImage, "/scenarios/product-catalog/images/aurora-desk-lamp.svg");
  assert.ok(deferred.every(({ image }) => image === productImagePath(CATALOG_PLACEHOLDER_SLUG)));
  assert.deepEqual(deferred.map(({ imageAlt }) => imageAlt), eager.map(({ imageAlt }) => imageAlt));

  // numbered-pages reads the same 23 records as following Next, over the same three pages.
  assert.deepEqual(records({ workflowId: "numbered-pages" }), records({ workflowId: "paginated-extraction" }));
});

test("show records each served view, clamps pages, bounds queries, and ignores invalid payloads", () => {
  const initial = scenario.createState(114);
  const second = apply(initial, "show", { page: 2 });
  assert.deepEqual(second.view, view(2));
  assert.deepEqual(second.oracle, { resultCount: 23, pageCount: 3, productIds: ids(...range(9, 16)) });
  assert.deepEqual(second.viewHistory, [view(2)]);
  assert.deepEqual(apply(initial, "show", { page: 99 }).view, view(3));
  assert.deepEqual(apply(initial, "show", { page: 99 }).oracle.productIds, ids(...range(17, 23)));
  for (const page of [0, -1, 1.5, "2", null]) assert.equal(apply(initial, "show", { page }).view.page, 1, String(page));
  const searched = apply(initial, "show", { query: "  LAMP  ", inStockOnly: true });
  assert.deepEqual(searched.view, view(1, "LAMP", true));
  assert.deepEqual(searched.oracle, { resultCount: 3, pageCount: 1, productIds: ids(1, 18, 23) });
  assert.equal(apply(initial, "show", { inStockOnly: "yes" }).view.inStockOnly, false);
  assert.equal(apply(initial, "show", { query: "x".repeat(200) }).view.query.length, 80);
  for (const payload of [null, "page", 3, ["page"]]) assert.equal(apply(initial, "show", payload), initial);
  assert.equal(apply(initial, "unknown-operation", { page: 2 }), initial);
  let busy = initial;
  for (let index = 0; index < 60; index += 1) busy = apply(busy, "show", { page: (index % 3) + 1 });
  assert.equal(busy.viewHistory.length, 50);
  assert.deepEqual(busy.viewHistory.at(-1), view(3));
});

test("set-variant arms each variant from the start page and baseline restores", () => {
  const initial = scenario.createState(114);
  const browsing = apply(initial, "show", { page: 2, inStockOnly: true });
  const drifted = apply(browsing, "set-variant", { variant: "text-variant" });
  assert.equal(drifted.variant, "text-variant");
  assert.deepEqual(drifted.view, view(1));
  assert.deepEqual(drifted.oracle, initial.oracle);
  assert.deepEqual(drifted.viewHistory, browsing.viewHistory);
  const short = apply(initial, "set-variant", { variant: "short-catalog" });
  assert.deepEqual(short.oracle, { resultCount: 5, pageCount: 1, productIds: ids(1, 2, 3, 4, 5) });
  const empty = apply(initial, "set-variant", { variant: "no-results" });
  assert.deepEqual(empty.oracle, initial.oracle);
  assert.deepEqual(apply(empty, "show", { query: "lamp" }).oracle, { resultCount: 0, pageCount: 1, productIds: [] });
  assert.equal(apply(empty, "show", { inStockOnly: true }).oracle.resultCount, 18);
  assert.deepEqual(apply(short, "set-variant", { variant: "baseline" }), { ...initial, variant: "baseline" });
  // The extraction variants change how a card is written, not which products the listing holds.
  for (const variant of ["sparse-cards", "absolute-links", "link-pagination", "lazy-images"] as const) {
    const armedState = apply(initial, "set-variant", { variant });
    assert.equal(armedState.variant, variant);
    assert.deepEqual(armedState.oracle, initial.oracle, variant);
    assert.deepEqual(armedState.view, view(1), variant);
  }
  for (const payload of [{ variant: "bogus" }, {}, null]) assert.equal(apply(initial, "set-variant", payload), initial);
});

test("view-product records opened pages of products in the current catalog only", () => {
  const initial = scenario.createState(114);
  assert.deepEqual(apply(initial, "view-product", { slug: "aurora-desk-lamp" }).productViews, ["aurora-desk-lamp"]);
  for (const payload of [{ slug: "not-a-product" }, { slug: 7 }, {}]) assert.equal(apply(initial, "view-product", payload), initial);
  const short = apply(initial, "set-variant", { variant: "short-catalog" });
  assert.equal(apply(short, "view-product", { slug: "willow-reading-lamp" }), short);
  assert.deepEqual(apply(short, "view-product", { slug: "cobalt-ceramic-mug" }).productViews, ["cobalt-ceramic-mug"]);
});

test("the start page renders page 1 under the armed variant with search, filter, and Next, and no run token", () => {
  const initial = scenario.createState(114);
  const html = scenario.render(initial, context);
  const markup = html.slice(0, html.indexOf("<script"));
  assert.match(html, /<h1>Product catalog<\/h1>/);
  for (const testId of ["search-form", "search-input", "search-submit", "in-stock-only", "results", "pagination-next"]) assert.equal(count(markup, testId), 1, testId);
  assert.equal(count(markup, "product-card"), 8);
  assert.match(html, /<p data-testid="result-count" role="status">23 products<\/p>/);
  assert.match(html, /<p data-testid="page-status">Page 1 of 3<\/p>/);
  assert.match(html, /href="\/scenarios\/product-catalog\/products\/aurora-desk-lamp">Aurora Desk Lamp<\/a>/);
  assert.match(html, /"\/scenarios\/product-catalog\/results"/);
  assert.equal(html.includes(context.runToken), false);
  assert.equal(scenario.render(apply(initial, "show", { page: 3 }), context), html);
  assert.match(scenario.render(apply(initial, "set-variant", { variant: "text-variant" }), context), /<p data-testid="product-price">49\.00 USD<\/p>/);
  const short = scenario.render(apply(initial, "set-variant", { variant: "short-catalog" }), context);
  assert.equal(count(short, "product-card"), 5);
  assert.equal(count(short, "pagination-next"), 0);
  assert.match(short, /Page 1 of 1/);
});

test("the results route serves the fragment for each view and records it through show", () => {
  const initial = scenario.createState(114);
  const first = route(initial, "results");
  assert.equal(first?.status, 200);
  assert.equal(count(first?.body ?? "", "product-card"), 8);
  assert.match(first?.body ?? "", /data-testid="pagination-next" data-page="2"/);
  assert.deepEqual(first?.mutation, { operation: "show", payload: view(1) });
  const last = route(initial, "results", "page=3")?.body ?? "";
  assert.equal(count(last, "product-card"), 7);
  assert.equal(count(last, "pagination-next"), 0);
  assert.match(last, /aria-current="page">3<\/button>/);
  assert.deepEqual(route(initial, "results", "page=abc")?.mutation?.payload, view(1));
  assert.deepEqual(route(initial, "results", "page=99")?.mutation?.payload, view(3));
  const search = route(initial, "results", "q=lamp")?.body ?? "";
  assert.match(search, /<h2 id="results-heading">Search results<\/h2>/);
  assert.match(search, /<p data-testid="search-summary">Results for &quot;lamp&quot;<\/p>/);
  assert.match(search, />4 results</);
  const filtered = route(initial, "results", "stock=in");
  assert.match(filtered?.body ?? "", /<p data-testid="active-filters">Filters: In stock only<\/p>/);
  assert.match(filtered?.body ?? "", />18 products</);
  assert.deepEqual(filtered?.mutation?.payload, view(1, "", true));
  assert.equal(count(route(initial, "results", "stock=yes")?.body ?? "", "active-filters"), 0);
  assert.equal((route(initial, "results", `q=${encodeURIComponent("<script>alert(1)</script>")}`)?.body ?? "").includes("<script>"), false);
  const empty = route(apply(initial, "set-variant", { variant: "no-results" }), "results", "q=lamp")?.body ?? "";
  assert.match(empty, />0 results</);
  assert.match(empty, /<p data-testid="empty-results">No products match your search\.<\/p>/);
  assert.equal(count(empty, "product-list") + count(empty, "pagination"), 0);
  assert.deepEqual(route(initial, "results", "page=2", "HEAD"), route(initial, "results", "page=2"));
  let walked = initial;
  for (const page of [2, 3]) {
    const response = route(walked, "results", `page=${page}`);
    assert.ok(response?.mutation);
    walked = apply(walked, response.mutation.operation, response.mutation.payload);
  }
  assert.deepEqual(walked.viewHistory, [view(2), view(3)]);
  assert.deepEqual(walked.oracle.productIds, ids(...range(17, 23)));
});

test("product routes serve a page per catalog product, record the visit, and 404 everything else", () => {
  const initial = scenario.createState(114);
  const product = route(initial, "products/ridge-clip-lamp");
  assert.equal(product?.status, 200);
  assert.match(product?.body ?? "", /<h1 data-testid="product-title">Ridge Clip Lamp<\/h1>/);
  assert.match(product?.body ?? "", /<p data-testid="product-price">\$34\.00<\/p>/);
  assert.match(product?.body ?? "", /data-testid="back-to-catalog" href="\/scenarios\/product-catalog\/"/);
  assert.deepEqual(product?.mutation, { operation: "view-product", payload: { slug: "ridge-clip-lamp" } });
  assert.match(route(apply(initial, "set-variant", { variant: "text-variant" }), "products/ridge-clip-lamp")?.body ?? "", />34\.00 USD</);
  for (const subpath of ["products/not-a-product", "products/", "products/Ridge-Clip-Lamp", "results/extra", "unknown"]) {
    assert.equal(route(initial, subpath), undefined, subpath);
  }
  assert.equal(route(apply(initial, "set-variant", { variant: "short-catalog" }), "products/ridge-clip-lamp"), undefined);
});

/**
 * Each extraction variant is a control for exactly one property of the card or
 * its pagination, so these assertions are written against the served markup: a
 * variant that changed anything else would show up here, rather than hiding
 * behind a record comparison that happens to still match.
 */
test("each extraction variant changes one card property and leaves the rest of the page alone", () => {
  const initial = scenario.createState(114);
  const occurrences = (html: string, needle: string) => html.split(needle).length - 1;
  const markupOf = (variant: CatalogVariant) => {
    const html = scenario.render(apply(initial, "set-variant", { variant }), context);
    return html.slice(0, html.indexOf("<script"));
  };

  const baseline = markupOf("baseline");
  assert.equal(count(baseline, "product-image"), 8);
  assert.match(baseline, /<img data-testid="product-image" alt="Aurora Desk Lamp product photo" width="48" height="48" src="\/scenarios\/product-catalog\/images\/aurora-desk-lamp\.svg">/);
  assert.equal(baseline.includes("data-src"), false, "an eager card carries no deferred source at all, so the field reads null");

  const lazy = markupOf("lazy-images");
  assert.equal(count(lazy, "product-image"), 8);
  assert.equal(occurrences(lazy, `src="${productImagePath(CATALOG_PLACEHOLDER_SLUG)}"`), 8);
  assert.match(lazy, /src="\/scenarios\/product-catalog\/images\/placeholder\.svg" data-src="\/scenarios\/product-catalog\/images\/aurora-desk-lamp\.svg" loading="lazy">/);

  const sparse = markupOf("sparse-cards");
  assert.equal(count(sparse, "product-card"), 8, "the cards are all still there; only two of their fields are not");
  assert.equal(count(sparse, "product-price"), 6);
  assert.equal(count(sparse, "product-rating"), 6);
  assert.equal(count(baseline, "product-price"), 8);
  assert.equal(count(baseline, "product-rating"), 8);

  const absolute = markupOf("absolute-links");
  assert.equal(occurrences(absolute, `href="${CATALOG_ABSOLUTE_ORIGIN}`), 8);
  assert.ok(absolute.includes(`href="${CATALOG_ABSOLUTE_ORIGIN}/scenarios/product-catalog/products/aurora-desk-lamp"`));
  assert.equal(baseline.includes(CATALOG_ABSOLUTE_ORIGIN), false);

  const links = markupOf("link-pagination");
  assert.match(links, /<a data-testid="pagination-next" data-page="2" href="\/scenarios\/product-catalog\/\?page=2" aria-label="Next page">Next<\/a>/);
  assert.equal(occurrences(links, '<button type="button" data-testid="pagination-next"'), 0);
  assert.equal(occurrences(baseline, '<button type="button" data-testid="pagination-next"'), 1);
  // numbered-pages reads these, and they are the same control in every mode.
  // Counted raw: `count` closes the quote, and these ids end in a page number.
  assert.equal(occurrences(links, 'data-testid="pagination-page-'), 3);
  assert.equal(occurrences(baseline, 'data-testid="pagination-page-'), 3);
});

test("card photos are served for the armed catalog only, and loading one records no visit", () => {
  const initial = scenario.createState(114);
  const image = route(initial, "images/aurora-desk-lamp.svg");
  assert.equal(image?.status, 200);
  assert.deepEqual(image?.headers, { "content-type": "image/svg+xml" });
  assert.match(image?.body ?? "", /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="48" height="48"/);
  assert.equal(image?.mutation, undefined, "loading an image is not a product visit");
  assert.equal(route(initial, `images/${CATALOG_PLACEHOLDER_SLUG}.svg`)?.status, 200);
  for (const subpath of ["images/not-a-product.svg", "images/aurora-desk-lamp.png", "images/aurora-desk-lamp", "images/", "images"]) {
    assert.equal(route(initial, subpath), undefined, subpath);
  }
  const short = apply(initial, "set-variant", { variant: "short-catalog" });
  assert.equal(route(short, "images/willow-reading-lamp.svg"), undefined, "a product the armed catalog lacks has no photo either");
  assert.equal(route(short, `images/${CATALOG_PLACEHOLDER_SLUG}.svg`)?.status, 200);
});
