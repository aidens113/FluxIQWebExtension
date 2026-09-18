import { expect, type Locator, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import {
  bookCounts, customerOrders, DISPATCH_RUN, filterOrders, firstLineOf, lineTotalPence,
  LINE_ITEM_ORDER, orderOperationsScenario, orderPath, orderTotalPence, REFUND_ORDER,
  type OrderOperationsState,
} from "../src/scenarios/order-operations/index.js";
import type { RunningScenarioLab } from "../src/server.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const manifest = orderOperationsScenario.manifest;
const START = orderOperationsScenario.startPath;
const SCENARIO = "order-operations";

// Seed 42, not the manifest seed: the book, and so every expected record, must not depend on the lab seed.
test.use({ labSeed: 42 });

type Selection = { workflowId?: string; variantId?: string };

const key = ({ workflowId, variantId }: Selection) => `${workflowId ?? "primary"}/${variantId ?? "unarmed"}`;
const bookState = (lab: RunningScenarioLab) => readFinalState<OrderOperationsState>(lab, SCENARIO);
const BASE = bookCounts(customerOrders);
const REFUND_PENCE = lineTotalPence(firstLineOf(REFUND_ORDER));
const DISPATCH_BATCH = filterOrders(customerOrders, DISPATCH_RUN);

/**
 * Every workflow whose recorded script plays through to the end. The drifted
 * rendering is a test of its own, because the recorded script cannot reach its
 * first control at all -- which is the whole point of it.
 */
const runs: Selection[] = [
  {},
  { workflowId: "export-order-batch" },
  { workflowId: "export-order-batch", variantId: "quiet-week" },
  { workflowId: "read-line-items" },
  { workflowId: "dispatch-batch" },
];

test("every manifest workflow and variant is either driven here or covered by its own test", () => {
  const declared = [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)].map((variantId) => key({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
  expect([...runs.map(key), "dispatch-batch/relabelled-dispatch"].sort()).toEqual([...declared].sort());
});

for (const run of runs) {
  test(`${key(run)} meets its page facts, extraction and final state`, async ({ page, lab, networkGuard: _guard }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const workflow = resolveScenarioWorkflow(manifest, run);
    const schedule = scenarioPageFactSchedule(manifest, run, workflow.variant ? "arms-before-loading" : "unarmed");
    if (workflow.variant) await armVariant(lab, SCENARIO, workflow.variant);
    await page.goto(`${lab.origin}${START}`);
    await assertFacts(page, schedule.atLoad);

    const extracted = await runScript(page, workflow.recordingScript);
    for (const expectation of workflow.expected.extracted ?? []) {
      const records = extracted.get(expectation.step);
      expect(records, expectation.step).toBeDefined();
      if (expectation.count !== undefined) expect(records, expectation.step).toHaveLength(expectation.count);
      if (expectation.records) expect(records, expectation.step).toEqual(expectation.records);
    }
    await assertFacts(page, workflow.expected.finalState);
    expect(pageErrors).toEqual([]);
  });
}

test("refunding one line leaves the desk holding a part-refunded order", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await runScript(page, manifest.recordingScript);
  expect(await bookState(lab)).toMatchObject({
    refunds: { [REFUND_ORDER.reference]: REFUND_PENCE },
    dispatched: [],
    oracle: { orderCount: BASE.orderCount, refundedCount: BASE.refundedCount + 1 },
  });
});

test("the dispatch run empties the state it was working in, and the desk records what went", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "dispatch-batch" });
  await page.goto(`${lab.origin}${START}`);
  await runScript(page, workflow.recordingScript);
  expect(await bookState(lab)).toMatchObject({
    dispatched: DISPATCH_BATCH.map(({ reference }) => reference),
    oracle: { awaitingDispatchCount: BASE.awaitingDispatchCount - DISPATCH_BATCH.length },
  });
});

test("the refund control stays off until an amount above zero and a reason are given", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${orderPath(REFUND_ORDER.reference)}`);
  const issue = page.getByTestId("issue-refund");
  await expect(issue).toBeDisabled();
  await page.getByTestId("refund-amount").fill("0");
  await page.getByTestId("refund-reason").selectOption("goodwill");
  await expect(issue).toBeDisabled();
  await page.getByTestId("refund-amount").fill("5.00");
  await expect(issue).toBeEnabled();
  await page.getByTestId("refund-reason").selectOption("");
  await expect(issue).toBeDisabled();
  expect(await bookState(lab)).toMatchObject({ refunds: {} });
});

test("an order nobody paid for offers no refund and no dispatch, before anything is pressed", async ({ page, lab, networkGuard: _guard }) => {
  const unpaid = customerOrders.find((order) => order.payment === "Failed");
  expect(unpaid, "the book holds no failed payment").toBeDefined();
  await page.goto(`${lab.origin}${orderPath(unpaid?.reference ?? "")}`);
  await expect(page.getByTestId("refund-blocked")).toBeVisible();
  await expect(page.getByTestId("refund-amount")).toBeDisabled();
  await expect(page.getByTestId("issue-refund")).toBeDisabled();
  await expect(page.getByTestId("mark-dispatched")).toBeDisabled();
  expect(await bookState(lab)).toMatchObject({ refunds: {}, dispatched: [] });
});

test("dispatch-batch/relabelled-dispatch: the recorded shortcut is gone, and pressing its replacement reaches the declared state", async ({ page, lab, networkGuard: _guard }) => {
  const selection = { workflowId: "dispatch-batch", variantId: "relabelled-dispatch" };
  const workflow = resolveScenarioWorkflow(manifest, selection);
  await armVariant(lab, SCENARIO, workflow.variant);
  await page.goto(`${lab.origin}${START}`);
  await assertFacts(page, scenarioPageFactSchedule(manifest, selection, "arms-before-loading").atLoad);

  await expect(locate(page, workflow.recordingScript[0]?.target)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dispatch run", exact: true })).toHaveCount(0);
  // The two pressable wrong answers are still there, so re-pointing the click
  // is a judgement rather than a guess at the only button left.
  for (const decoy of ["Export", "New order"]) {
    await expect(page.getByRole("button", { name: decoy, exact: true })).toHaveCount(1);
  }

  // The repaired run: the same script with its first click re-pointed.
  await page.getByRole("button", { name: "Pick and pack", exact: true }).click();
  const extracted = await runScript(page, workflow.recordingScript.slice(1));
  for (const expectation of workflow.expected.extracted ?? []) {
    expect(extracted.get(expectation.step), expectation.step).toEqual(expectation.records);
  }
  await assertFacts(page, workflow.expected.finalState);
  expect(await bookState(lab)).toMatchObject({ mode: "relabelled-dispatch", dispatched: DISPATCH_BATCH.map(({ reference }) => reference) });
});

test("the book is application-shaped: hashed classes, 280 identical action buttons, and lines only on the order", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  const shape = await page.evaluate(() => {
    const classes = new Set<string>();
    for (const element of document.querySelectorAll("[class]")) for (const name of element.classList) classes.add(name);
    return {
      elements: document.querySelectorAll("*").length,
      authored: [...classes].filter((name) => !/^css-[0-9a-z]{7}$/.test(name)),
      unnamedButtons: [...document.querySelectorAll("button")].filter((button) =>
        !button.textContent?.trim() && !button.getAttribute("aria-label") && !button.getAttribute("title")).length,
    };
  });
  console.log(`order-operations page shape: ${JSON.stringify(shape)}`);
  expect(shape.elements).toBeGreaterThan(3_000);
  expect(shape.authored).toEqual([]);
  expect(shape.unnamedButtons).toBe(1);

  await expect(page.getByRole("button", { name: "More actions", exact: true })).toHaveCount(280);
  await expect(page.getByRole("checkbox", { name: "Select order", exact: true })).toHaveCount(280);
  await expect(page.getByLabel("Search", { exact: true })).toHaveCount(2);

  // The row action button and the top bar's notification button are the same
  // component, so they wear the same generated class.
  const rowButton = page.locator(`[data-order-ref="${REFUND_ORDER.reference}"] button[aria-haspopup="menu"]`);
  const bell = page.getByRole("button", { name: "Notifications", exact: true });
  expect(await rowButton.getAttribute("class")).toBe(await bell.getAttribute("class"));

  // The lines an order is made of are on the order and nowhere else, so a run
  // that needs one has to open it.
  const page1 = await page.content();
  expect(page1).not.toContain(firstLineOf(LINE_ITEM_ORDER).sku);
  await page.locator(`[data-order-ref="${LINE_ITEM_ORDER.reference}"] a`).click();
  await expect(page.getByTestId("line-items")).toBeVisible();
  await expect(page.getByTestId("order-total")).toHaveText(new RegExp(String(orderTotalPence(LINE_ITEM_ORDER) % 100).padStart(2, "0") + "$"));
  await expect(page.getByTestId("delivery-address")).toBeVisible();
});

test("filters, the date range and the empty state behave as a back office does", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(`${lab.origin}${START}`);
  await expect(page.getByTestId("filter-summary")).toHaveCount(0);
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.orderCount} of ${BASE.orderCount} orders`);

  await page.getByTestId("fulfilment-filter").selectOption("unfulfilled");
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.awaitingDispatchCount} of ${BASE.orderCount} orders`);
  await expect(page.getByTestId("filter-summary")).toContainText("Fulfilment: Unfulfilled");

  // A half-typed date is no bound at all, so the list does not move until the
  // box holds a whole day.
  await page.getByTestId("placed-from").fill("2026-03");
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.awaitingDispatchCount} of ${BASE.orderCount} orders`);
  await page.getByTestId("placed-from").fill("2026-04-01");
  await expect(page.getByTestId("result-count")).toHaveText(`Showing 0 of ${BASE.orderCount} orders`);
  await expect(page.locator("tbody")).toContainText("No orders match these filters.");

  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByTestId("result-count")).toHaveText(`Showing ${BASE.orderCount} of ${BASE.orderCount} orders`);
  expect(await bookState(lab)).toMatchObject({ refunds: {}, dispatched: [], cancelled: [] });
});

/** A manifest target: `testid:`, `role:<role>[:<name>]`, or a raw CSS selector, read the way the runner reads one. */
function locate(page: Page, target: string | undefined): Locator {
  if (!target) throw new Error("Scenario step target is required");
  if (target.startsWith("testid:")) return page.getByTestId(target.slice("testid:".length));
  if (target.startsWith("role:")) {
    const body = target.slice("role:".length);
    const separator = body.indexOf(":");
    const role = (separator < 0 ? body : body.slice(0, separator)) as Parameters<Page["getByRole"]>[0];
    return separator < 0 ? page.getByRole(role) : page.getByRole(role, { name: body.slice(separator + 1), exact: true });
  }
  return page.locator(target);
}

async function assertFacts(page: Page, facts: readonly ExpectedFact[] = []): Promise<void> {
  for (const fact of facts) {
    if (fact.predicate.startsWith("label-count:")) {
      const label = fact.predicate.slice("label-count:".length);
      await expect(page.locator("label").filter({ hasText: label }), fact.id).toHaveCount(Number(fact.value));
      continue;
    }
    if (fact.predicate === "path") {
      expect(new URL(page.url()).pathname, fact.id).toBe(String(fact.value));
      continue;
    }
    const target = page.getByTestId(fact.subject);
    if (fact.predicate === "text") await expect(target, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "exists") await expect(target, fact.id).toHaveCount(fact.value === true ? 1 : 0);
    else if (fact.predicate === "visible") await expect(target, fact.id).toBeVisible({ visible: fact.value === true });
    else throw new Error(`Unsupported predicate ${fact.predicate}`);
  }
}

/** Plays a recording script with plain Playwright and returns each extract step's records. */
async function runScript(page: Page, script: readonly ScenarioStep[]): Promise<Map<string, Array<Record<string, string>>>> {
  const extracted = new Map<string, Array<Record<string, string>>>();
  for (const step of script) {
    const target = () => locate(page, step.target);
    if (step.operation === "click") await target().click();
    else if (step.operation === "type") await target().fill(String(step.value));
    else if (step.operation === "select") await target().selectOption(String(step.value));
    else if (step.operation === "check") await target().setChecked(step.value === true);
    else if (step.operation === "waitForState") await expect(target(), step.id).toBeVisible(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs });
    else if (step.operation === "extract") extracted.set(step.id, await extract(page, step));
    else if (step.operation !== "checkpoint") throw new Error(`Unsupported step ${step.operation}`);
  }
  return extracted;
}

/** `column:<header>` reads the cell under that header; anything else is a selector inside the item. */
async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target).all()) {
    const record: Record<string, string> = {};
    for (const [name, selector] of Object.entries(step.fields ?? {})) {
      record[name] = selector.startsWith("column:")
        ? await readColumn(item, selector.slice("column:".length))
        : ((await item.locator(selector).first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
    }
    records.push(record);
  }
  return records;
}

function readColumn(row: Locator, header: string): Promise<string> {
  return row.evaluate((element, wanted) => {
    const normalize = (text: string | null) => (text ?? "").replace(/\s+/gu, " ").trim();
    const cells = [...(element as HTMLTableRowElement).cells];
    const headerCells = [...((element as HTMLTableRowElement).closest("table")?.tHead?.rows[0]?.cells ?? [])];
    const index = headerCells.findIndex((cell) => normalize(cell.textContent) === wanted);
    return index < 0 ? "" : normalize(cells[index]?.textContent ?? "");
  }, header);
}
