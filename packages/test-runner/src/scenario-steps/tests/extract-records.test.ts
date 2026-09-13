import assert from "node:assert/strict";
import test from "node:test";
import type { Locator } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { extractRecords, parseExtractField } from "../extract-records.js";
import type { TargetScope } from "../locate-target.js";

type FakeCell = { tagName: string; textContent: string | null };
type FakeRow = { tagName: string; cells: FakeCell[]; closest(selector: string): unknown };
type FakeElement = { text?: string; attributes?: Record<string, string>; children?: Record<string, FakeElement>; row?: FakeRow };

function elementLocator(element: FakeElement | undefined): Locator {
  const locator = {
    locator: (selector: string) => elementLocator(element?.children?.[selector]),
    getByRole: (role: string, options?: { name?: string }) => elementLocator(element?.children?.[`role=${role}:${options?.name ?? ""}`]),
    frameLocator: () => { throw new Error("no frames in this fake"); },
    first: () => locator,
    count: async () => (element ? 1 : 0),
    textContent: async () => element?.text ?? null,
    getAttribute: async (name: string) => element?.attributes?.[name] ?? null,
    evaluate: async (callback: (value: unknown, argument: unknown) => unknown, argument: unknown) => callback(element?.row ?? { tagName: "DIV" }, argument),
  };
  return locator as unknown as Locator;
}

function pageWithItems(selector: string, items: FakeElement[]): TargetScope {
  return {
    locator: (wanted) => ({ all: async () => (wanted === selector ? items.map(elementLocator) : []) }) as unknown as Locator,
    getByRole: () => { throw new Error("items are located by CSS in this fake"); },
    frameLocator: () => { throw new Error("no frames in this fake"); },
  };
}

function tableRows(headers: string[], rows: string[][]): FakeElement[] {
  const headerRow: FakeRow = { tagName: "TR", cells: headers.map((text) => ({ tagName: "TH", textContent: ` ${text} ` })), closest: () => null };
  const table = { tHead: { rows: [headerRow] }, rows: [headerRow] };
  return rows.map((cells) => ({ row: { tagName: "TR", cells: cells.map((text) => ({ tagName: "TD", textContent: `\n ${text}  ` })), closest: () => table } }));
}

test("field specs use the step target grammar, with an optional @attribute and the table-only column: form", () => {
  assert.deepEqual(parseExtractField("column:  Price "), { kind: "column", header: "Price" });
  assert.deepEqual(parseExtractField("testid:post-title"), { kind: "element", target: { kind: "testid", id: "post-title" } });
  assert.deepEqual(parseExtractField("role:link:Open@href"), { kind: "element", target: { kind: "role", role: "link", name: "Open" }, attribute: "href" });
  assert.deepEqual(parseExtractField("a.product@href"), { kind: "element", target: { kind: "css", selector: "a.product" }, attribute: "href" });
  assert.deepEqual(parseExtractField("@data-sku"), { kind: "element", attribute: "data-sku" });
  assert.deepEqual(parseExtractField('[title="a@b"]'), { kind: "element", target: { kind: "css", selector: '[title="a@b"]' } });
  assert.throws(() => parseExtractField("column: "), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid");
});

test("reads normalized text and raw attributes per item, leaving out a field whose element is absent", async () => {
  const items: FakeElement[] = [
    { attributes: { "data-sku": "K-1" }, children: { '[data-testid="name"]': { text: "  Electric\n kettle " }, "role=link:Open": { attributes: { href: "/scenarios/product-catalog/products/k-1" } } } },
    { attributes: { "data-sku": "L-2" }, children: { '[data-testid="name"]': { text: "Lamp" } } },
  ];
  const records = await extractRecords(pageWithItems('[data-testid="product"]', items), {
    id: "read", operation: "extract", target: "testid:product",
    fields: { name: "testid:name", url: "role:link:Open@href", sku: "@data-sku" },
  });
  assert.deepEqual(records, [
    { name: "Electric kettle", url: "/scenarios/product-catalog/products/k-1", sku: "K-1" },
    { name: "Lamp", sku: "L-2" },
  ]);
});

test("column: reads the cell under the matching header, so a column reorder yields the same records", async () => {
  const step = { id: "rows", operation: "extract" as const, target: "tbody tr", fields: { product: "column:Product", price: "column:Price" } };
  const original = await extractRecords(pageWithItems("tbody tr", tableRows(["Product", "Category", "Price"], [["Kettle", "Kitchen", "$25.00"]])), step);
  const reordered = await extractRecords(pageWithItems("tbody tr", tableRows(["Price", "Product", "Category"], [["$25.00", "Kettle", "Kitchen"]])), step);
  assert.deepEqual(original, [{ product: "Kettle", price: "$25.00" }]);
  assert.deepEqual(reordered, original);
});

test("a missing header, a non-row item, or a step without fields fails", async () => {
  const rows = tableRows(["Product"], [["Kettle"]]);
  await assert.rejects(extractRecords(pageWithItems("tr", rows), { id: "x", operation: "extract", target: "tr", fields: { price: "column:Price" } }), /header was not found/);
  await assert.rejects(extractRecords(pageWithItems("li", [{ text: "Kettle" }]), { id: "x", operation: "extract", target: "li", fields: { price: "column:Price" } }), /table rows/);
  await assert.rejects(extractRecords(pageWithItems("li", []), { id: "x", operation: "extract", target: "li" }), /names no fields/);
});

const CARDS = '[data-testid="card"]';
const NEXT = '[data-testid="next"]';
const card = (name: string): FakeElement => ({ children: { '[data-testid="name"]': { text: name } } });

/**
 * Pages of cards behind a Next control. A click replaces the page only after
 * `latencyMs`, as product-catalog's results region does, so a reader that does
 * not wait reads the page it just read again. `replaces: false` never replaces it.
 */
function paginatedScope(pages: FakeElement[][], options: { latencyMs: number; replaces?: boolean }) {
  let current = 0;
  const clicks: number[] = [];
  const handleOnPage = (page: number) => ({ evaluate: async (callback: (element: { isConnected: boolean }) => boolean) => callback({ isConnected: current === page }), dispose: async () => undefined });
  const next = {
    count: async () => (current < pages.length - 1 ? 1 : 0),
    click: async () => {
      const from = current;
      clicks.push(from);
      if (options.replaces !== false) setTimeout(() => { current = from + 1; }, options.latencyMs);
    },
    elementHandle: async () => handleOnPage(current),
  };
  const scope: TargetScope = {
    locator: (selector) => {
      if (selector === NEXT) return next as unknown as Locator;
      const page = current;
      return { all: async () => (selector === CARDS ? (pages[page] ?? []).map((element) => Object.assign(elementLocator(element), { elementHandle: async () => handleOnPage(page) })) : []) } as unknown as Locator;
    },
    getByRole: () => { throw new Error("targets are located by CSS in this fake"); },
    frameLocator: () => { throw new Error("no frames in this fake"); },
  };
  return { scope, clicks };
}

const catalogPages = () => [[card("Kettle"), card("Lamp")], [card("Mug"), card("Napkins")], [card("Oven mitt")]];
const paginatedStep = (maxPages: number, timeoutMs?: number) => ({ id: "extract-all-pages", operation: "extract" as const, target: "testid:card", fields: { name: "testid:name" }, pagination: { next: "testid:next", maxPages }, ...(timeoutMs === undefined ? {} : { timeoutMs }) });

test("a paginated extract clicks next, waits until the page it read is replaced, and reads every page in order", async () => {
  const { scope, clicks } = paginatedScope(catalogPages(), { latencyMs: 40 });
  const records = await extractRecords(scope, paginatedStep(5));
  assert.deepEqual(records.map((record) => record.name), ["Kettle", "Lamp", "Mug", "Napkins", "Oven mitt"], "no page is read twice, and the last is read once Next is absent");
  assert.deepEqual(clicks, [0, 1], "Next is clicked on every page that has one, as recorded input");
});

test("maxPages bounds the pages read, the first included, and an unpaginated extract never clicks", async () => {
  const bounded = paginatedScope(catalogPages(), { latencyMs: 10 });
  assert.deepEqual((await extractRecords(bounded.scope, paginatedStep(2))).map((record) => record.name), ["Kettle", "Lamp", "Mug", "Napkins"]);
  assert.deepEqual(bounded.clicks, [0]);
  const unpaginated = paginatedScope(catalogPages(), { latencyMs: 10 });
  assert.deepEqual((await extractRecords(unpaginated.scope, { id: "extract-page-one", operation: "extract", target: "testid:card", fields: { name: "testid:name" } })).map((record) => record.name), ["Kettle", "Lamp"]);
  assert.deepEqual(unpaginated.clicks, []);
});

test("a followed next that never replaces the page fails the step instead of reading that page again", async () => {
  const { scope, clicks } = paginatedScope(catalogPages(), { latencyMs: 0, replaces: false });
  await assert.rejects(extractRecords(scope, paginatedStep(5, 150)), (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /followed next from page 1, and that page was not replaced within 150 ms/u.test(error.message));
  assert.deepEqual(clicks, [0]);
});
