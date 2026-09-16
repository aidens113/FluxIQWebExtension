import { expect, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedExtraction, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { dataTableScenario, type DataTableState } from "../src/scenarios/data-table/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

type Records = Array<Record<string, string>>;
const { manifest } = dataTableScenario;
const firstRowCells = (page: Page) => page.getByTestId("inventory-row").first().locator("td");

const tableState = (lab: RunningScenarioLab) => readFinalState<DataTableState>(lab, "data-table");

function css(target: string | undefined): string {
  if (!target) throw new Error("Scenario step target is required");
  return target.startsWith("testid:") ? `[data-testid="${target.slice("testid:".length)}"]` : target;
}

/** Drives a recording script with plain Playwright and returns what each extract step read. */
async function runScript(page: Page, script: ScenarioStep[]): Promise<Record<string, Records>> {
  const extracted: Record<string, Records> = {};
  for (const step of script) {
    if (step.operation === "click") await page.locator(css(step.target)).click();
    else if (step.operation === "extract") extracted[step.id] = await extractByHeader(page, css(step.target), step.fields ?? {});
    else throw new Error(`The data-table spec does not drive ${step.operation} steps`);
  }
  return extracted;
}

/** Resolves each `column:<header>` field through the header row of the table that holds the item. */
function extractByHeader(page: Page, target: string, fields: Record<string, string>): Promise<Records> {
  return page.locator(target).evaluateAll((items, fieldMap) => items.map((item) => {
    const row = item as HTMLTableRowElement;
    const headers = Array.from(row.closest("table")?.tHead?.rows[0]?.cells ?? [], (cell) => cell.textContent?.trim() ?? "");
    return Object.fromEntries(Object.entries(fieldMap).map(([name, selector]) => {
      if (!selector.startsWith("column:")) throw new Error(`Unsupported field selector ${selector}`);
      const index = headers.indexOf(selector.slice("column:".length));
      if (index < 0) throw new Error(`No column headed ${selector}`);
      return [name, row.cells[index]?.textContent?.trim() ?? ""];
    }));
  }), fields);
}

/**
 * Judges what each extract step read. `pages` and `truncated` are refused
 * rather than skipped: this spec drives the script with plain Playwright, so it
 * follows no pagination and applies no extraction cap, and neither field is
 * anything it observes. Skipping them is how an expectation nothing judges
 * reads as a pass, which is the defect X5-F removed from the runner; the
 * `large-table` variant's `truncated: true` is unjudgeable here for that
 * reason, and says so loudly the moment a test reaches it.
 */
function expectExtracted(extracted: Record<string, Records>, expectations: ExpectedExtraction[] = []): void {
  expect(expectations.length).toBeGreaterThan(0);
  for (const expectation of expectations) {
    const unjudgeable = (["pages", "truncated"] as const).filter((field) => expectation[field] !== undefined);
    if (unjudgeable.length > 0) {
      throw new Error(`Extract step ${expectation.step} declares ${unjudgeable.join(" and ")}, which this spec's reader never observes, so the expectation cannot be judged`);
    }
    const actual = extracted[expectation.step];
    if (expectation.count !== undefined) expect(actual).toHaveLength(expectation.count);
    if (expectation.records) expect(actual).toEqual(expectation.records);
  }
}

async function expectFinalState(page: Page, facts: ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    if (fact.predicate !== "text") throw new Error(`The data-table spec does not assert ${fact.predicate} facts`);
    await expect(page.getByTestId(fact.subject)).toHaveText(String(fact.value));
  }
}

test("an extraction expectation this spec cannot observe is refused rather than skipped", () => {
  const read = { "extract-inventory": [] };
  const refuse = (expectation: ExpectedExtraction) => () => expectExtracted(read, [expectation]);
  expect(refuse({ step: "extract-inventory", truncated: true })).toThrow(/declares truncated, which this spec's reader never observes/);
  expect(refuse({ step: "extract-inventory", pages: 2 })).toThrow(/declares pages, which this spec's reader never observes/);
  expect(refuse({ step: "extract-inventory", pages: 2, truncated: true })).toThrow(/declares pages and truncated/);
  // An entry declaring neither is judged as before, so the guard costs the judgeable case nothing.
  expect(refuse({ step: "extract-inventory", count: 0, records: [] })).not.toThrow();
  // The entry this guard exists for: only the extraction engine's 1,000-record cap
  // can report `truncated`, so no test in this spec may claim to have judged it.
  const largeTable = manifest.variants?.find(({ id }) => id === "large-table");
  expect(largeTable?.expected.extracted).toEqual([{ step: "extract-inventory", count: 1000, truncated: true }]);
});

test("W08 extracts every inventory row through its column headers", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest);
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await expect(page.getByRole("table", { name: "Current stock by product" })).toBeVisible();
  await expect(page.locator("thead th")).toHaveText(["Product", "Category", "Price", "Stock"]);
  expectExtracted(await runScript(page, workflow.recordingScript), workflow.expected.extracted);
  await expectFinalState(page, workflow.expected.finalState);
  expect(await tableState(lab)).toMatchObject({
    seedMarker: "data-table-seed-42", columnOrder: ["product", "category", "price", "stock"], sort: null, sortCount: 0, lastOperation: "seeded",
  });
});

test("W08 column-reorder: every column moves and extraction by header yields the same records", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { variantId: "column-reorder" });
  if (!workflow.variant) throw new Error("column-reorder variant is missing");
  expect(workflow.expected.extracted).toEqual(resolveScenarioWorkflow(manifest).expected.extracted);
  await armVariant(lab, "data-table", workflow.variant);
  await page.goto(`${lab.origin}${manifest.startPath}`);
  await expect(page.locator("thead th")).toHaveText(["Price", "Stock", "Category", "Product"]);
  await expect(firstRowCells(page)).toHaveText(["$34.00", "18", "Kitchen", "Ceramic pour-over set"]);
  const extracted = await runScript(page, workflow.recordingScript);
  expectExtracted(extracted, workflow.expected.extracted);
  const positional = await page.getByTestId("inventory-row").evaluateAll((rows) => rows.map((row) => {
    const [product, category, price, stock] = Array.from((row as HTMLTableRowElement).cells, (cell) => cell.textContent ?? "");
    return { product, category, price, stock };
  }));
  expect(positional, "reading cells by index must now be wrong").not.toEqual(extracted["extract-inventory"]);
  await expectFinalState(page, workflow.expected.finalState);
  expect(await tableState(lab)).toMatchObject({ columnOrder: ["price", "stock", "category", "product"], sort: null, lastOperation: "columns-reordered" });
});

test("W09 sorts by price and extracts the cheapest row; the sort persists and toggles", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "sort-by-price" });
  await page.goto(`${lab.origin}${manifest.startPath}`);
  const priceHeader = page.getByRole("columnheader", { name: "Price" });
  await expect(page.locator("thead th[aria-sort]")).toHaveCount(0);
  // Extraction runs straight after the click: the table must already be sorted when the click returns.
  expectExtracted(await runScript(page, workflow.recordingScript), workflow.expected.extracted);
  await expectFinalState(page, workflow.expected.finalState);
  await expect(priceHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(page.locator("thead th[aria-sort]")).toHaveCount(1);
  await expect.poll(async () => (await tableState(lab)).sort).toEqual({ column: "price", direction: "ascending" });
  const sorted = await tableState(lab);
  expect(sorted).toMatchObject({ sortCount: 1, lastOperation: "sorted" });
  expect(await page.getByTestId("inventory-row").evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.rowId))).toEqual(sorted.view.rowOrder);

  await page.reload();
  await expect(priceHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(firstRowCells(page).first()).toHaveText("Recycled notebook set");

  await page.getByTestId("sort-price").click();
  await expect(priceHeader).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByTestId("sort-status")).toHaveText("Sorted by Price, descending");
  await expect(firstRowCells(page).first()).toHaveText("Brass desk lamp");
  await expect.poll(async () => (await tableState(lab)).sort).toEqual({ column: "price", direction: "descending" });
  expect((await tableState(lab)).sortCount).toBe(2);
});
