import { expect, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ExpectedFact, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { RunningScenarioLab } from "../src/server.js";
import { feedItem, infiniteFeedScenario, type InfiniteFeedState } from "../src/scenarios/infinite-feed/index.js";
import { armVariant, readFinalState, test } from "./lab-fixture.js";

const SEED = 42;
const START = "/scenarios/infinite-feed/";
const EXTRACT_STEP = "extract-loaded-posts";
type ExtractedRecord = Record<string, string>;

// The expected records derive from SEED, so the lab runs on it.
test.use({ labSeed: SEED });

const feedState = (lab: RunningScenarioLab) => readFinalState<InfiniteFeedState>(lab, "infinite-feed");

// Mirrors the runner's step semantics for the operations W11 uses: `testid:`
// targets, a mouse wheel for `scroll`, and `selector@attribute` extract fields.
const selector = (target: string) => target.startsWith("testid:") ? `[data-testid=${JSON.stringify(target.slice(7))}]` : target;

async function extract(page: Page, step: ScenarioStep): Promise<ExtractedRecord[]> {
  const records: ExtractedRecord[] = [];
  for (const item of await page.locator(selector(step.target ?? "")).all()) {
    const record: ExtractedRecord = {};
    for (const [field, spec] of Object.entries(step.fields ?? {})) {
      const at = spec.lastIndexOf("@");
      const element = item.locator(selector(at > 0 ? spec.slice(0, at) : spec)).first();
      record[field] = at > 0 ? await element.getAttribute(spec.slice(at + 1)) ?? "" : (await element.textContent() ?? "").trim();
    }
    records.push(record);
  }
  return records;
}

async function runScript(page: Page, steps: readonly ScenarioStep[]): Promise<Map<string, ExtractedRecord[]>> {
  const extracted = new Map<string, ExtractedRecord[]>();
  for (const step of steps) {
    if (step.operation === "scroll") await page.mouse.wheel(0, Number(step.value));
    else if (step.operation === "waitForState") await page.locator(selector(step.target ?? "")).waitFor({ state: "visible", ...(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs }) });
    else if (step.operation === "extract") extracted.set(step.id, await extract(page, step));
    else if (step.operation !== "checkpoint") throw new Error(`W11 uses no ${step.operation} step`);
  }
  return extracted;
}

async function assertFacts(page: Page, facts: readonly ExpectedFact[]): Promise<void> {
  for (const fact of facts) {
    const subject = page.locator(selector(`testid:${fact.subject}`));
    if (fact.predicate === "text") await expect(subject.first()).toHaveText(String(fact.value));
    else if (fact.predicate === "visible") await (fact.value ? expect(subject.first()).toBeVisible() : expect(subject.first()).toBeHidden());
    else if (fact.predicate === "exists") await expect(subject).toHaveCount(fact.value ? 1 : 0);
    else throw new Error(`Unsupported fact predicate ${fact.predicate}`);
  }
}

function expectedRecords(count: number): ExtractedRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const { title, author, published } = feedItem(SEED, index + 1);
    return { title, author, published };
  });
}

async function openFeed(page: Page, lab: RunningScenarioLab): Promise<void> {
  await page.goto(`${lab.origin}${START}`);
  await expect(page.getByTestId("feed-status")).toHaveText("Showing 10 posts");
  await expect(page.getByTestId("feed-item")).toHaveCount(10);
}

function pageRequests(page: Page): string[] {
  const paths: string[] = [];
  page.on("request", request => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith(`${START}page/`)) paths.push(pathname);
  });
  return paths;
}

test("W11 loads exactly 40 posts with the fixed scroll steps and extracts them in feed order", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(infiniteFeedScenario.manifest);
  const requests = pageRequests(page);
  await openFeed(page, lab);
  expect(await feedState(lab)).toEqual({ mode: "baseline", feedLength: 60, loadedCount: 10, ended: false, sessions: 1, lastOperation: "opened" });

  const extracted = await runScript(page, workflow.recordingScript);
  expect(workflow.expected.extracted).toEqual([{ step: EXTRACT_STEP, count: 40 }]);
  expect(extracted.get(EXTRACT_STEP)).toEqual(expectedRecords(40));
  await assertFacts(page, workflow.expected.finalState ?? []);
  expect(requests).toEqual([2, 3, 4].map(number => `${START}page/${number}`));
  // Nothing is left to trigger a fifth page: the sentinel sits below the viewport and no load is in flight.
  expect(await page.getByTestId("feed-sentinel").evaluate(element => element.getBoundingClientRect().top > window.innerHeight)).toBe(true);
  await expect(page.getByTestId("feed-loading")).toBeHidden();
  await expect(page.getByTestId("feed")).toHaveAttribute("aria-busy", "false");
  expect(await feedState(lab)).toEqual({ mode: "baseline", feedLength: 60, loadedCount: 40, ended: false, sessions: 1, lastOperation: "page-loaded" });
});

test("a load shows the loading indicator and busy feed, and rapid scrolls append one page at a time", async ({ page, lab, networkGuard: _guard }) => {
  const requests = pageRequests(page);
  await openFeed(page, lab);
  await page.mouse.wheel(0, 2000);
  await page.mouse.wheel(0, 2000);
  await page.getByTestId("feed-loading").waitFor({ state: "visible" });
  await expect(page.getByTestId("feed")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("feed-status")).toHaveText("Showing 20 posts");
  await expect(page.getByTestId("feed-loading")).toBeHidden();
  await expect(page.getByTestId("feed")).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId("feed-page-2").getByTestId("feed-item")).toHaveCount(10);
  const positions = await page.getByTestId("feed-item").evaluateAll(items => items.map(item => item.getAttribute("aria-posinset")));
  expect(positions).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 1)));
  expect(requests).toEqual([`${START}page/2`]);
  expect(await feedState(lab)).toMatchObject({ loadedCount: 20, ended: false });
});

test("reopening the feed starts a fresh session at page one", async ({ page, lab, networkGuard: _guard }) => {
  await openFeed(page, lab);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByTestId("feed-status")).toHaveText("Showing 20 posts");
  await page.reload();
  await expect(page.getByTestId("feed-status")).toHaveText("Showing 10 posts");
  await expect(page.getByTestId("feed-page-2")).toHaveCount(0);
  expect(await feedState(lab)).toEqual({ mode: "baseline", feedLength: 60, loadedCount: 10, ended: false, sessions: 2, lastOperation: "opened" });
});

test("end-early variant: the feed ends at 25 posts and extraction succeeds with 25", async ({ page, lab, networkGuard: _guard }) => {
  const workflow = resolveScenarioWorkflow(infiniteFeedScenario.manifest, { variantId: "end-early" });
  if (!workflow.variant) throw new Error("end-early variant is missing");
  await armVariant(lab, "infinite-feed", workflow.variant);
  expect(await feedState(lab)).toMatchObject({ mode: "end-early", feedLength: 25, ended: false });
  const requests = pageRequests(page);
  await openFeed(page, lab);

  // The recording's fixed scroll steps; the feed runs out during the second.
  const settled = ["Showing 20 posts", "Showing all 25 posts", "Showing all 25 posts"];
  const scrolls = workflow.recordingScript.filter(({ operation }) => operation === "scroll");
  expect(scrolls).toHaveLength(settled.length);
  for (const [index, step] of scrolls.entries()) {
    await page.mouse.wheel(0, Number(step.value));
    await expect(page.getByTestId("feed-status")).toHaveText(settled[index] ?? "");
  }
  await expect(page.getByTestId("feed-sentinel")).toHaveCount(0);
  await expect(page.getByTestId("feed-page-3").getByTestId("feed-item")).toHaveCount(5);

  const extractStep = workflow.recordingScript.find(({ id }) => id === EXTRACT_STEP);
  if (!extractStep) throw new Error("extract step is missing");
  expect(workflow.expected.extracted).toEqual([{ step: EXTRACT_STEP, count: 25 }]);
  expect(await extract(page, extractStep)).toEqual(expectedRecords(25));
  await assertFacts(page, workflow.expected.finalState ?? []);
  expect(requests).toEqual([`${START}page/2`, `${START}page/3`]);
  expect(await feedState(lab)).toEqual({ mode: "end-early", feedLength: 25, loadedCount: 25, ended: true, sessions: 1, lastOperation: "page-loaded" });
});
