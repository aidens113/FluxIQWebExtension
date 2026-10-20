import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { productCatalogScenario } from "../scenario.js";
import type { CatalogView, ProductCatalogState } from "../types.js";

/**
 * The catalog's server side, driven over HTTP exactly as its client script and
 * the Testing Lab drive it: each results view through the `results` route the
 * page fetches, product pages through their route, variant arms through
 * `/api/product-catalog/set-variant`, and the oracle through
 * `/__control/final-state`. These replace the server-side halves of the
 * retired browser spec; its browser halves (search waiting for submit, the
 * busy swap between pages, reading cards with selectors) are fixture behaviour
 * no browser test may open.
 */

const SCENARIO = "product-catalog";
const START = productCatalogScenario.startPath;
const manifest = productCatalogScenario.manifest;
const view = (page: number, query = "", inStockOnly = false): CatalogView => ({ page, query, inStockOnly });
const ids = (...numbers: number[]) => numbers.map((number) => `p${String(number).padStart(2, "0")}`);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const lastPage = { resultCount: 23, pageCount: 3, productIds: ids(...range(17, 23)) };

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "product-catalog-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    get: async (path: string, method = "GET") => {
      const response = await fetch(`${lab.origin}${path}`, { method });
      return { status: response.status, body: await response.text() };
    },
    arm: async (selection: { workflowId?: string; variantId: string }) => {
      const { variant } = resolveScenarioWorkflow(manifest, selection);
      assert.ok(variant, selection.variantId);
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${variant.arm.operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(variant.arm.payload ?? {}),
      });
      assert.equal(response.status, 200, `arming ${selection.variantId}`);
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: ProductCatalogState }).state;
    },
  };
}

test("over HTTP, paging to the end records each served view and leaves the last page as the oracle", async () => withLab(async (io) => {
  for (const page of [2, 3]) assert.equal((await io.get(`${START}results?page=${page}`)).status, 200);
  const state = await io.state();
  assert.deepEqual([state.view, state.oracle, state.viewHistory], [view(3), lastPage, [view(2), view(3)]]);
}));

test("over HTTP, a search and the in-stock filter combine, a product page records its visit, and an unknown one is 404", async () => withLab(async (io) => {
  await io.get(`${START}results?page=2`);
  assert.match((await io.get(`${START}results?q=lamp`)).body, />4 results</);
  const filtered = (await io.get(`${START}results?q=lamp&stock=in`)).body;
  assert.match(filtered, />3 results</);
  assert.deepEqual([...filtered.matchAll(/data-testid="product-name"[^>]*>(?:<a [^>]*>)?([^<]+)</gu)].map((match) => match[1]), ["Aurora Desk Lamp", "Ridge Clip Lamp", "Willow Reading Lamp"]);
  const searched = await io.state();
  assert.deepEqual([searched.view, searched.viewHistory], [view(1, "lamp", true), [view(2), view(1, "lamp"), view(1, "lamp", true)]]);

  assert.equal((await io.get(`${START}products/ridge-clip-lamp`, "HEAD")).status, 200);
  assert.deepEqual((await io.state()).productViews, [], "HEAD records no visit");
  const product = await io.get(`${START}products/ridge-clip-lamp`);
  assert.match(product.body, /data-testid="product-price">\$34\.00</);
  assert.deepEqual((await io.state()).productViews, ["ridge-clip-lamp"]);
  assert.equal((await io.get(`${START}products/not-a-product`)).status, 404);
}));

test("over HTTP, each listing variant's arm resets to the start page and changes the oracle the runs end on", async () => withLab(async (io) => {
  await io.arm({ workflowId: "paginated-extraction", variantId: "short-catalog" });
  assert.deepEqual((await io.state()).oracle, { resultCount: 5, pageCount: 1, productIds: ids(...range(1, 5)) });
  assert.equal((await io.get(`${START}products/willow-reading-lamp`)).status, 404, "a product the short catalog lacks has no page");

  await io.arm({ workflowId: "search", variantId: "no-results" });
  await io.get(`${START}results?q=lamp`);
  assert.deepEqual((await io.state()).oracle, { resultCount: 0, pageCount: 1, productIds: [] });

  await io.arm({ workflowId: "paginated-extraction", variantId: "link-pagination" });
  assert.match((await io.get(START)).body, /<a data-testid="pagination-next" data-page="2" href=/);
  for (const page of [2, 3]) await io.get(`${START}results?page=${page}`);
  const linked = await io.state();
  assert.deepEqual([linked.variant, linked.oracle], ["link-pagination", lastPage]);

  await io.arm({ workflowId: "with-images", variantId: "lazy-images" });
  assert.match((await io.get(START)).body, /data-src="\/scenarios\/product-catalog\/images\/aurora-desk-lamp\.svg" loading="lazy"/);
}));

test("over HTTP, the in-stock read of all three pages ends on page 3 of 18 products", async () => withLab(async (io) => {
  for (const page of [1, 2, 3]) await io.get(`${START}results?page=${page}&stock=in`);
  const state = await io.state();
  assert.deepEqual(state.oracle, { resultCount: 18, pageCount: 3, productIds: ids(22, 23) });
  assert.deepEqual(state.viewHistory, [view(1, "", true), view(2, "", true), view(3, "", true)]);
}));
