import { expect, type Locator, type Page } from "@playwright/test";
import {
  resolveScenarioWorkflow, scenarioPageFactSchedule,
  type ExpectedExtraction, type ExpectedFact, type ScenarioStep,
} from "@fluxiq-web-extension/test-contracts";
import { productCatalogScenario, type CatalogView, type ProductCatalogState } from "../src/scenarios/product-catalog/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = productCatalogScenario.manifest;
const START = productCatalogScenario.startPath;

// Seed 42, not the manifest seed 114: the catalog, and so every expected record, must not depend on the lab seed.
test.use({ labSeed: 42 });

/** A field an item does not carry reads as no value at all, never as an empty string (D16). */
type Records = Array<Record<string, string | null>>;
/** What one extract step read: the records, and how many pages it covered getting them. */
type PageRead = { records: Records; pages: number };
type Run = { row: string; workflowId?: string; variantId?: string; state: Partial<ProductCatalogState> };

const view = (page: number, query = "", inStockOnly = false): CatalogView => ({ page, query, inStockOnly });
const ids = (...numbers: number[]) => numbers.map((number) => `p${String(number).padStart(2, "0")}`);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
const key = ({ workflowId, variantId }: { workflowId?: string; variantId?: string }) => `${workflowId ?? "primary"}/${variantId ?? "baseline"}`;

const firstPage = { resultCount: 23, pageCount: 3, productIds: ids(...range(1, 8)) };
/** Page 3 of the whole catalog: where every read of all three pages ends (D5). */
const lastPage = { resultCount: 23, pageCount: 3, productIds: ids(...range(17, 23)) };
/** The views a read of all three pages records on its way to the last one. */
const pagedToLast = [view(2), view(3)];
/** `with-images` and `numbered-pages` are extraction workflows that no corpus row names. */
const NO_ROW = "no corpus row";

/**
 * Every manifest workflow and variant, with the server oracle its run must
 * leave behind. The order is the manifest's own enumeration, which the first
 * test below pins, so a fixture that gains a workflow or a variant fails here
 * until it gains a run.
 */
const runs: Run[] = [
  { row: "W04", state: { variant: "baseline", view: view(1), oracle: firstPage, viewHistory: [] } },
  { row: "W04", variantId: "text-variant", state: { variant: "text-variant", view: view(1), oracle: firstPage, viewHistory: [] } },
  // sparse-cards and absolute-links change how a card renders, not which products list, so the oracle is the baseline's.
  { row: "W04", variantId: "sparse-cards", state: { variant: "sparse-cards", view: view(1), oracle: firstPage, viewHistory: [] } },
  { row: "W04", variantId: "absolute-links", state: { variant: "absolute-links", view: view(1), oracle: firstPage, viewHistory: [] } },
  {
    row: "W05", workflowId: "paginated-extraction",
    state: { variant: "baseline", view: view(3), oracle: lastPage, viewHistory: pagedToLast },
  },
  {
    row: "W05", workflowId: "paginated-extraction", variantId: "short-catalog",
    state: { variant: "short-catalog", view: view(1), oracle: { resultCount: 5, pageCount: 1, productIds: ids(...range(1, 5)) }, viewHistory: [] },
  },
  {
    // Next is an anchor here, so the same three pages must be reached by following a link rather than pressing a button.
    row: "W05", workflowId: "paginated-extraction", variantId: "link-pagination",
    state: { variant: "link-pagination", view: view(3), oracle: lastPage, viewHistory: pagedToLast },
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
  { row: NO_ROW, workflowId: "with-images", state: { variant: "baseline", view: view(1), oracle: firstPage, viewHistory: [] } },
  {
    row: NO_ROW, workflowId: "with-images", variantId: "lazy-images",
    state: { variant: "lazy-images", view: view(1), oracle: firstPage, viewHistory: [] },
  },
  {
    // Reaches all three pages through the numbered controls instead of Next, so it ends on page 3 like the Next-driven read.
    row: NO_ROW, workflowId: "numbered-pages",
    state: { variant: "baseline", view: view(3), oracle: lastPage, viewHistory: pagedToLast },
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
    // This spec arms before it loads, so the facts due at load are the armed
    // rendering's for a variant and the workflow's own otherwise.
    await assertFacts(page, scenarioPageFactSchedule(manifest, run, "arms-before-loading").atLoad);
    const extracted = await runScript(page, workflow.recordingScript);
    for (const expectation of workflow.expected.extracted ?? []) {
      const read = extracted.get(expectation.step);
      expect(read, expectation.step).toBeDefined();
      if (read) expectExtracted(read, expectation);
    }
    await assertFacts(page, workflow.expected.finalState ?? []);
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

/** A `testid:` target or a plain CSS one, which the numbered pagination controls use. */
function locate(page: Page, target: string | undefined): Locator {
  if (!target) throw new Error("Scenario step target is required");
  return target.startsWith("testid:") ? page.getByTestId(target.slice("testid:".length)) : page.locator(target);
}

/**
 * Judges one extract expectation against what the step read. An expectation
 * this reader cannot observe is refused rather than skipped: a declared field
 * that nothing reports would otherwise read as a pass (X5-F).
 */
function expectExtracted({ records, pages }: PageRead, expectation: ExpectedExtraction): void {
  if (expectation.truncated !== undefined) {
    throw new Error(`Extract step ${expectation.step} declares truncated, which this spec's own reader never reports, so the expectation cannot be judged`);
  }
  if (expectation.count !== undefined) expect(records, expectation.step).toHaveLength(expectation.count);
  if (expectation.records) expect(records, expectation.step).toEqual(expectation.records);
  if (expectation.pages !== undefined) expect(pages, `${expectation.step} pages read`).toBe(expectation.pages);
}

async function assertFacts(page: Page, facts: readonly ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    const target = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(target, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "exists") await expect(target, fact.id).toHaveCount(fact.value === true ? 1 : 0);
    else throw new Error(`Unsupported predicate ${fact.predicate}`);
  }
}

/** Plays a recording script with plain Playwright and returns what each extract step read, keyed by step id. */
async function runScript(page: Page, script: ScenarioStep[]): Promise<Map<string, PageRead>> {
  const extracted = new Map<string, PageRead>();
  for (const step of script) {
    if (step.operation === "type") await locate(page, step.target).fill(String(step.value));
    else if (step.operation === "press") await locate(page, step.target).press(String(step.value));
    else if (step.operation === "check") await locate(page, step.target).setChecked(step.value === true);
    else if (step.operation === "waitForState") await expect(locate(page, step.target)).toBeVisible(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs });
    else if (step.operation === "extract") extracted.set(step.id, await extract(page, step));
    else if (step.operation !== "checkpoint") throw new Error(`Unsupported step ${step.operation}`);
  }
  return extracted;
}

/**
 * Reads every item on the settled page, then reaches each further page in the
 * step's pagination mode until no page is left or `maxPages` pages were read:
 * `next` follows the Next control, `numbered` visits each page control in turn.
 * `loadMore` and `scroll` are not driven here -- this fixture offers neither.
 */
async function extract(page: Page, step: ScenarioStep): Promise<PageRead> {
  const { pagination } = step;
  const records: Records = [];
  for (let pagesRead = 1; ; pagesRead += 1) {
    await expect(page.getByTestId("results")).toHaveAttribute("aria-busy", "false");
    records.push(...await readItems(page, step));
    if (!pagination) return { records, pages: pagesRead };
    if (pagination.mode === "numbered") {
      const controls = page.locator(pagination.pages);
      // Control 0 is the page just read, so the next control is at the index of the pages read so far.
      if (pagesRead >= pagination.maxPages || pagesRead >= await controls.count()) return { records, pages: pagesRead };
      await turnPage(page, controls.nth(pagesRead));
    } else if (pagination.mode === undefined || pagination.mode === "next") {
      const next = locate(page, pagination.next);
      if (pagesRead >= pagination.maxPages || await next.count() === 0) return { records, pages: pagesRead };
      await turnPage(page, next);
    } else {
      throw new Error(`The product-catalog spec does not drive ${pagination.mode} pagination`);
    }
  }
}

/** Presses a pagination control and waits for the new view to replace the old one, which the page swaps in after a fixed delay. */
async function turnPage(page: Page, control: Locator): Promise<void> {
  const status = await page.getByTestId("page-status").textContent() ?? "";
  await control.click();
  await expect(page.getByTestId("page-status")).not.toHaveText(status);
}

/**
 * Reads each item's fields. A field whose element is absent, or whose named
 * attribute the element does not carry, is `null`: nothing was read, rather
 * than something read as blank.
 */
function readItems(page: Page, step: ScenarioStep): Promise<Records> {
  return locate(page, step.target).evaluateAll((items, fields) => items.map((item) => Object.fromEntries(
    Object.entries(fields).map(([name, spec]): [string, string | null] => {
      const at = spec.lastIndexOf("@");
      const target = at > 0 ? spec.slice(0, at) : spec;
      const attribute = at > 0 ? spec.slice(at + 1) : undefined;
      const element = item.querySelector(target.startsWith("testid:") ? `[data-testid="${target.slice("testid:".length)}"]` : target);
      if (!element) return [name, null];
      return [name, attribute === undefined ? element.textContent?.trim() ?? "" : element.getAttribute(attribute)];
    }),
  )), step.fields ?? {});
}
