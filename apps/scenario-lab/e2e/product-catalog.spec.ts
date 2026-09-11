import { expect, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { productCatalogScenario, type CatalogView, type ProductCatalogState } from "../src/scenarios/product-catalog/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = productCatalogScenario.manifest;
const START = productCatalogScenario.startPath;

// Seed 42, not the manifest seed 114: the catalog, and so every expected record, must not depend on the lab seed.
test.use({ labSeed: 42 });

type Run = { row: string; workflowId?: string; variantId?: string; state: Partial<ProductCatalogState> };

const view = (page: number, query = "", inStockOnly = false): CatalogView => ({ page, query, inStockOnly });
const ids = (...numbers: number[]) => numbers.map((number) => `p${String(number).padStart(2, "0")}`);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const key = ({ workflowId, variantId }: { workflowId?: string; variantId?: string }) => `${workflowId ?? "primary"}/${variantId ?? "baseline"}`;
const firstPage = { resultCount: 23, pageCount: 3, productIds: ids(...range(1, 8)) };

/** Every manifest workflow and variant, with the server oracle its run must leave behind. */
const runs: Run[] = [
  { row: "W04", state: { variant: "baseline", view: view(1), oracle: firstPage, viewHistory: [] } },
  { row: "W04", variantId: "text-variant", state: { variant: "text-variant", view: view(1), oracle: firstPage, viewHistory: [] } },
  {
    row: "W05", workflowId: "paginated-extraction",
    state: { variant: "baseline", view: view(3), oracle: { resultCount: 23, pageCount: 3, productIds: ids(...range(17, 23)) }, viewHistory: [view(2), view(3)] },
  },
  {
    row: "W05", workflowId: "paginated-extraction", variantId: "short-catalog",
    state: { variant: "short-catalog", view: view(1), oracle: { resultCount: 5, pageCount: 1, productIds: ids(...range(1, 5)) }, viewHistory: [] },
  },
  {
    row: "W06", workflowId: "search",
    state: { variant: "baseline", view: view(1, "lamp"), oracle: { resultCount: 4, pageCount: 1, productIds: ids(1, 10, 18, 23) }, viewHistory: [view(1, "lamp")] },
  },
  {
    row: "W06", workflowId: "search", variantId: "no-results",
    state: { variant: "no-results", view: view(1, "lamp"), oracle: { resultCount: 0, pageCount: 1, productIds: [] }, viewHistory: [view(1, "lamp")] },
  },
  {
    row: "W07", workflowId: "in-stock-only",
    state: {
      variant: "baseline", view: view(3, "", true), oracle: { resultCount: 18, pageCount: 3, productIds: ids(22, 23) },
      viewHistory: [view(1, "", true), view(2, "", true), view(3, "", true)],
    },
  },
];

test("every manifest workflow and variant has an e2e run", () => {
  const declared = [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)].map((variantId) => key({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
  expect(runs.map(key)).toEqual(declared);
});

for (const run of runs) {
  test(`${run.row} ${key(run)} extracts the expected records and leaves the expected state`, async ({ page, lab, networkGuard: _guard }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const workflow = resolveScenarioWorkflow(manifest, run);
    if (workflow.variant) await armVariant(lab, "product-catalog", workflow.variant);
    await page.goto(`${lab.origin}${START}`);
    await assertFacts(page, workflow.expected.pageFacts);
    const extracted = await runScript(page, workflow.recordingScript);
    for (const expectation of workflow.expected.extracted ?? []) {
      const records = extracted.get(expectation.step);
      expect(records, expectation.step).toBeDefined();
      if (expectation.count !== undefined) expect(records, expectation.step).toHaveLength(expectation.count);
      if (expectation.records) expect(records, expectation.step).toEqual(expectation.records);
    }
    await assertFacts(page, workflow.expected.finalState);
    expect(await catalogState(lab)).toMatchObject(run.state);
    expect(pageErrors).toEqual([]);
  });
}

test("search waits for submit, pages and the filter combine with it, and a product link opens its route page", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await page.getByTestId("search-input").fill("lamp");
  await page.getByTestId("pagination-page-2").click();
  await expect(page.getByTestId("page-status")).toHaveText("Page 2 of 3");
  await expect(page.getByTestId("result-count")).toHaveText("23 products");
  await expect(page.getByTestId("search-summary")).toHaveCount(0);
  await expect(page.getByTestId("product-name").first()).toHaveText("Iris Linen Napkins");

  await page.getByTestId("search-submit").click();
  await expect(page.getByTestId("search-summary")).toHaveText(`Results for "lamp"`);
  await expect(page.getByTestId("result-count")).toHaveText("4 results");
  await expect(page.getByTestId("page-status")).toHaveText("Page 1 of 1");
  await expect(page.getByTestId("pagination-next")).toHaveCount(0);

  await page.getByTestId("in-stock-only").check();
  await expect(page.getByTestId("active-filters")).toHaveText("Filters: In stock only");
  await expect(page.getByTestId("result-count")).toHaveText("3 results");
  await expect(page.getByTestId("product-name")).toHaveText(["Aurora Desk Lamp", "Ridge Clip Lamp", "Willow Reading Lamp"]);
  expect(await catalogState(lab)).toMatchObject({ view: view(1, "lamp", true), viewHistory: [view(2), view(1, "lamp"), view(1, "lamp", true)] });

  await page.getByRole("link", { name: "Ridge Clip Lamp" }).click();
  await expect(page).toHaveURL(`${lab.origin}${START}products/ridge-clip-lamp`);
  await expect(page.getByTestId("product-title")).toHaveText("Ridge Clip Lamp");
  await expect(page.getByTestId("product-price")).toHaveText("$34.00");
  expect(await catalogState(lab)).toMatchObject({ productViews: ["ridge-clip-lamp"] });

  await page.getByTestId("back-to-catalog").click();
  await expect(page.getByTestId("page-status")).toHaveText("Page 1 of 3");
  await expect(page.getByTestId("result-count")).toHaveText("23 products");
  expect((await fetch(`${lab.origin}${START}products/not-a-product`)).status).toBe(404);
});

const catalogState = (lab: RunningScenarioLab) => readFinalState<ProductCatalogState>(lab, "product-catalog");

function byTestId(page: Page, selector: string | undefined) {
  if (!selector?.startsWith("testid:")) throw new Error(`Unsupported selector ${selector}`);
  return page.getByTestId(selector.slice("testid:".length));
}

async function assertFacts(page: Page, facts: ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    const target = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(target, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "exists") await expect(target, fact.id).toHaveCount(fact.value === true ? 1 : 0);
    else throw new Error(`Unsupported predicate ${fact.predicate}`);
  }
}

/** Plays a recording script with plain Playwright and returns the records of each extract step, keyed by step id. */
async function runScript(page: Page, script: ScenarioStep[]): Promise<Map<string, Array<Record<string, string>>>> {
  const extracted = new Map<string, Array<Record<string, string>>>();
  for (const step of script) {
    if (step.operation === "type") await byTestId(page, step.target).fill(String(step.value));
    else if (step.operation === "press") await byTestId(page, step.target).press(String(step.value));
    else if (step.operation === "check") await byTestId(page, step.target).setChecked(step.value === true);
    else if (step.operation === "waitForState") await expect(byTestId(page, step.target)).toBeVisible(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs });
    else if (step.operation === "extract") extracted.set(step.id, await extract(page, step));
    else if (step.operation !== "checkpoint") throw new Error(`Unsupported step ${step.operation}`);
  }
  return extracted;
}

/** Reads every item on the settled page, then follows the pagination control until it is absent or `maxPages` pages were read. */
async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (let read = 1; ; read += 1) {
    await expect(page.getByTestId("results")).toHaveAttribute("aria-busy", "false");
    records.push(...await byTestId(page, step.target).evaluateAll((items, fields) => items.map((item) => Object.fromEntries(
      Object.entries(fields).map(([name, selector]) => {
        const [target = "", attribute] = selector.split("@");
        const element = item.querySelector(`[data-testid="${target.slice("testid:".length)}"]`);
        return [name, attribute === undefined ? element?.textContent?.trim() ?? "" : element?.getAttribute(attribute) ?? ""];
      }),
    )), step.fields ?? {}));
    const pagination = step.pagination;
    if (!pagination || read >= pagination.maxPages) return records;
    const next = byTestId(page, pagination.next);
    if (await next.count() === 0) return records;
    const status = await page.getByTestId("page-status").textContent() ?? "";
    await next.click();
    await expect(page.getByTestId("page-status")).not.toHaveText(status);
  }
}
