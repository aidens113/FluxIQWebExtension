import { expect, type BrowserContext, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { RunningScenarioLab } from "../src/server.js";
import { multiTabScenario, type MultiTabState } from "../src/scenarios/multi-tab/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

// The lab runs on the manifest's seed, as the runner does by default, so the
// manifest's expected extraction applies to the rendered pages unchanged.
test.use({ labSeed: multiTabScenario.seed });

const manifest = multiTabScenario.manifest;
const startUrl = (lab: RunningScenarioLab) => `${lab.origin}${manifest.startPath}`;
const pathOf = (page: Page) => { try { return new URL(page.url()).pathname; } catch { return ""; } };
const locate = (page: Page, target: string) => target.startsWith("testid:") ? page.getByTestId(target.slice("testid:".length)) : page.locator(target);

const finalState = (lab: RunningScenarioLab) => readFinalState<MultiTabState>(lab, "multi-tab");

/**
 * Plain-Playwright execution of manifest steps. `switchTab` activates the open
 * tab whose URL path matches and remembers the tab it left; `closeTab` closes
 * the active tab and returns to that one.
 */
async function runSteps(context: BrowserContext, start: Page, steps: ScenarioStep[]) {
  let active = start;
  const left: Page[] = [];
  const extracted = new Map<string, Array<Record<string, string>>>();
  for (const step of steps) {
    const timeout = step.timeoutMs ?? 3000;
    if (step.operation === "click") await locate(active, step.target!).click();
    else if (step.operation === "switchTab") {
      const find = () => context.pages().find((candidate) => pathOf(candidate) === step.path);
      await expect.poll(() => find() !== undefined, { timeout, message: `an open tab at ${step.path}` }).toBe(true);
      left.push(active);
      active = find()!;
      await active.bringToFront();
    } else if (step.operation === "waitForState") await locate(active, step.target!).waitFor({ state: "visible", timeout });
    else if (step.operation === "extract") extracted.set(step.id, await extract(active, step));
    else if (step.operation === "closeTab") {
      await active.close();
      active = left.pop() ?? context.pages()[0]!;
      await active.bringToFront();
    } else if (step.operation !== "checkpoint") throw new Error(`multi-tab spec does not drive ${step.operation}`);
  }
  return { page: active, extracted };
}

async function extract(page: Page, step: ScenarioStep): Promise<Array<Record<string, string>>> {
  const records: Array<Record<string, string>> = [];
  for (const item of await locate(page, step.target!).all()) {
    const record: Record<string, string> = {};
    for (const [field, selector] of Object.entries(step.fields ?? {})) record[field] = ((await item.locator(selector).textContent()) ?? "").trim();
    records.push(record);
  }
  return records;
}

/** The runner's DOM fact predicates this manifest uses, asserted with web-first expectations. */
async function expectFacts(page: Page, facts: readonly ExpectedFact[]): Promise<void> {
  for (const fact of facts) {
    const subject = page.getByTestId(fact.subject);
    if (fact.predicate === "path") await expect.poll(() => pathOf(page), { message: fact.id }).toBe(fact.value);
    else if (fact.predicate === "text") await expect(subject, fact.id).toHaveText(String(fact.value));
    else if (fact.predicate === "contains") await expect(subject, fact.id).toContainText(String(fact.value));
    else if (fact.predicate === "exists") await expect(subject, fact.id).toHaveCount(fact.value ? 1 : 0);
    else if (fact.predicate === "visible" && fact.value === true) await expect(subject, fact.id).toBeVisible();
    else throw new Error(`multi-tab spec does not evaluate ${fact.predicate}=${String(fact.value)}`);
  }
}

test("W15 opens details in a new tab, switches, extracts, closes the tab, and confirms on the list", async ({ context, page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest);
  await page.goto(startUrl(lab));
  await expectFacts(page, workflow.expected.pageFacts ?? []);

  const run = await runSteps(context, page, workflow.recordingScript);

  expect(run.page).toBe(page);
  expect(context.pages()).toEqual([page]);
  for (const expectation of workflow.expected.extracted ?? []) {
    const records = run.extracted.get(expectation.step);
    if (expectation.count !== undefined) expect(records).toHaveLength(expectation.count);
    if (expectation.records !== undefined) expect(records).toEqual(expectation.records);
  }
  await expectFacts(page, workflow.expected.finalState ?? []);
  const state = await finalState(lab);
  expect(run.extracted.get("extract-order-details")).toEqual(state.orders.filter((order) => order.order === "PO-4472"));
  expect(state).toMatchObject({ popupsBlocked: false, detailsVisits: [{ order: "PO-4472", via: "link" }], blockedOpens: [], reviewedOrders: ["PO-4472"] });
});

test("the window.open control opens the newest order in a new page that the route records", async ({ context, page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  const [opened] = await Promise.all([context.waitForEvent("page"), page.getByTestId("open-newest-window").click()]);
  await expect(opened.getByTestId("detail-order")).toHaveText("PO-4474");
  expect(pathOf(opened)).toBe("/scenarios/multi-tab/details/PO-4474");
  await expect(page.getByTestId("open-notice")).toHaveText("");
  expect((await finalState(lab)).detailsVisits).toEqual([{ order: "PO-4474", via: "window" }]);
});

test("the list refuses to confirm a review until that order's details were opened", async ({ page, lab, networkGuard: _guard }) => {
  await page.goto(startUrl(lab));
  await page.getByTestId("confirm-review-po-4471").click();
  await expect(page.getByTestId("review-result")).toHaveText("Open the PO-4471 details before confirming its review.");
  await expect(page.getByTestId("reviewed-po-4471")).toHaveCount(0);
  expect((await finalState(lab)).reviewedOrders).toEqual([]);
});

test("popup-blocked: both open paths show the inline notice, no tab opens, and switchTab has nothing to find", async ({ context, page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(manifest, { variantId: "popup-blocked" });
  const variant = workflow.variant!;
  await armVariant(lab, "multi-tab", variant);
  await page.goto(startUrl(lab));
  const [openStep, switchStep] = workflow.recordingScript;

  await runSteps(context, page, [openStep!]);
  await expect(page.getByTestId("open-notice")).toHaveText("Pop-up blocked: PO-4472 did not open. Allow pop-ups for this site, then try again.");
  await expect(runSteps(context, page, [{ ...switchStep!, timeoutMs: 1000 }])).rejects.toThrow(/an open tab at \/scenarios\/multi-tab\/details\/PO-4472/);
  expect(context.pages()).toEqual([page]);
  await expectFacts(page, workflow.expected.finalState ?? []);
  expect(workflow.expected.failure).toEqual({ category: "output_not_observed" });
  expect(workflow.expected.extracted).toEqual([]);

  await page.getByTestId("open-newest-window").click();
  await expect(page.getByTestId("open-notice")).toHaveText("Pop-up blocked: PO-4474 did not open. Allow pop-ups for this site, then try again.");
  expect(context.pages()).toEqual([page]);
  await expect.poll(async () => (await finalState(lab)).blockedOpens).toEqual([{ order: "PO-4472", via: "link" }, { order: "PO-4474", via: "window" }]);
  expect(await finalState(lab)).toMatchObject({ popupsBlocked: true, detailsVisits: [], reviewedOrders: [] });
});
