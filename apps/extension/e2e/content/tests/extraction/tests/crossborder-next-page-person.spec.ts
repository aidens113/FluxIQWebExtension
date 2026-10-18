// The real content-script handoff at a completed Next move: the realistic
// marketplace's third search load is a person-only check. The harness plays
// the worker's marked-arrival resend, then the person, then the next read.
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import { MARKET_SEED } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/manifest/index.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test, type ContentHarness } from "../../../index.js";

const SEARCH = "/scenarios/crossborder-marketplace/search?q=usb+c+hub";

async function arrived(harness: ContentHarness, message: unknown): Promise<BrowserActionResult> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await harness.page.waitForLoadState("load");
    try {
      const delivered = await harness.deliver(message);
      if (delivered.responded) return delivered.response as BrowserActionResult;
    } catch (error) {
      if (!/Execution context was destroyed|Cannot find context/u.test(String(error))) throw error;
    }
    await harness.page.waitForTimeout(100);
  }
  throw new Error("The new document did not answer its marked Next landing.");
}

test("Next reaches a person-only check, asks without reloading, and the next read stays on the cleared page", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  await expect(page.getByText("Welcome back, Mara!", { exact: true })).toBeVisible();
  await page.getByText("No thanks", { exact: true }).click();
  await page.getByText("Accept all", { exact: true }).click();
  await page.goto(new URL(SEARCH, harness.lab.origin).href);
  await page.goto(new URL(`${SEARCH}&page=2`, harness.lab.origin).href);
  await expect(page.locator('a[href*="page=3"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/item/"]').first()).toBeVisible();
  const classes = marketClasses(MARKET_SEED, "baseline");
  const item = `.${classes.card}`;
  const action: BrowserActionCommand = { commandId: "next-to-check", actionType: "web.dom.next_page", timeoutMs: 30_000, nextPage: { item, pagination: { mode: "numbered", pages: `.${classes.pager} > a.${classes.pagerItem}` } } };
  const message = { type: "executeAction", topFrameOnly: true, action, extraction: { token: "person-next" } };
  const first = await harness.deliver(message).catch(() => undefined);
  const reply = first?.responded ? first.response as BrowserActionResult : await arrived(harness, { ...message, extraction: { token: "person-next", resume: { by: "numbered" } } });
  expect(reply.status, JSON.stringify({ nextPage: reply.nextPage, validation: reply.validation })).toBe("failed");
  expect(reply.failure?.code).toBe(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  expect(reply.failure?.actual).toMatch(/^captcha:/u);
  expect(reply.nextPage).toBeUndefined();
  expect(new URL(page.url()).searchParams.get("page")).toBe("3");
  await expect(page.getByText("I'm not a robot", { exact: true })).toBeVisible();
  // The automation leaves the page alone; the person performs the fixture's
  // explicit check, then Continue takes the Flow to its next one-page read.
  let requests = 0;
  const count = (request: { url(): string }) => { if (new URL(request.url()).pathname.endsWith("/search")) requests += 1; };
  page.on("request", count);
  await page.waitForTimeout(200);
  expect(requests, "the failed node must not reload or retry the check").toBe(0);
  await page.getByText("I'm not a robot", { exact: true }).click();
  await expect(page.getByText("I'm not a robot", { exact: true })).toHaveCount(0);
  await expect(page.locator(item).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("page")).toBe("3");
  const read = await harness.runAction({ commandId: "read-cleared-page", actionType: "web.dom.extract_list", extractList: { item, fields: { title: `.${classes.cardTitle}` } } });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  expect(read.extraction?.recordCount ?? 0).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.get("page")).toBe("3");
  page.off("request", count);
});
