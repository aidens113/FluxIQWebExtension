import assert from "node:assert/strict";
import test from "node:test";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { dataTableScenario } from "../scenario.js";
import type { DataTableState } from "../table-state.js";

/**
 * The table's server side over HTTP: the client posts `sort`, the Testing Lab
 * arms `column-reorder` through the mutation endpoint, and a reload is a fresh
 * GET of the start page. These replace the server-side halves of the retired
 * browser spec; reading cells through headers in a live DOM is fixture-only.
 */

const START = dataTableScenario.manifest.startPath;

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "data-table-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    page: async () => (await fetch(`${lab.origin}${START}`)).text(),
    post: async (operation: string, payload: unknown = {}) => {
      const response = await fetch(`${lab.origin}/api/data-table/${operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      assert.equal(response.status, 200, operation);
      await response.text();
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=data-table`, { headers: { authorization } });
      return (await response.json() as { state: DataTableState }).state;
    },
  };
}

const headers = (html: string) => [...html.matchAll(/<th scope="col"[^>]*><button[^>]*>([^<]*)<\/button><\/th>/g)].map((match) => match[1]);
const rowIds = (html: string) => [...html.matchAll(/<tr data-testid="inventory-row" data-row-id="([^"]+)"/g)].map((match) => match[1]);

test("over HTTP, a posted sort persists into the next served page and toggles on a second post", async () => withLab(async (io) => {
  assert.deepEqual((await io.state()).sort, null);
  await io.post("sort", { column: "price" });
  const ascending = await io.state();
  assert.deepEqual([ascending.sort, ascending.sortCount, ascending.lastOperation], [{ column: "price", direction: "ascending" }, 1, "sorted"]);
  const reloaded = await io.page();
  assert.match(reloaded, /<th scope="col" aria-sort="ascending"><button type="button" data-testid="sort-price">Price<\/button><\/th>/);
  assert.match(reloaded, /<p data-testid="sort-status" role="status">Sorted by Price, ascending<\/p>/);
  assert.deepEqual(rowIds(reloaded), ascending.view.rowOrder, "the served rows are in the order the oracle reports");

  await io.post("sort", { column: "price" });
  const descending = await io.state();
  assert.deepEqual([descending.sort, descending.sortCount], [{ column: "price", direction: "descending" }, 2]);
  assert.match(await io.page(), /Sorted by Price, descending/);
}));

test("over HTTP, the column-reorder arm moves every header in the next served page and leaves the sort alone", async () => withLab(async (io) => {
  const variant = dataTableScenario.manifest.variants?.find(({ id }) => id === "column-reorder");
  assert.ok(variant);
  await io.post(variant.arm.operation, variant.arm.payload);
  const state = await io.state();
  assert.deepEqual([state.columnOrder, state.sort, state.lastOperation], [["price", "stock", "category", "product"], null, "columns-reordered"]);
  assert.deepEqual(headers(await io.page()), ["Price", "Stock", "Category", "Product"]);
}));
