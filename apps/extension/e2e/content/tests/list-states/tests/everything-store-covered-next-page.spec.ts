// `web.dom.next_page` on the everything store's results while a layer stands
// over the page: the pager is not pressed through it (t762, from t758's trace).
//
// The `deal-wheel` variant opens a spin-to-win promotion over its first results
// page a moment after load and makes the page behind it `inert`. A script's
// `click()` is not stopped by that, so until 2026-10-27 reads, the pager and Load
// more acted straight through the wheel: Next page followed the pager to page two
// with the promotion unanswered, where a person cannot press anything.
//
// - The wheel's own way out is a line of text, "No thanks, I would rather pay full
//   price", which the interference defence presses (`dialog-dismissal.spec.ts`).
//   Next page now closes the wheel first, then follows Next: the site records the
//   promotion as dismissed, which a press through the wheel leaves pending.
// - A dialog with no way out stays: Next page answers `control_not_clickable`
//   naming the layer, presses nothing, and the address is still page one.

import type { WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds";
const TOKEN = "covered-next-page-spec";
const WHEEL = '[data-testid="deal-wheel"]';

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Opens the search, passing the store's browser check when it stands. */
async function openSearch(harness: ContentHarness): Promise<void> {
  const url = new URL(SEARCH, harness.lab.origin).href;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await harness.page.goto(url, { waitUntil: "load" }).catch(() => undefined);
    const blocked = await harness.page.locator("[data-continue]").count().catch(() => 1);
    if (!blocked) return;
    await harness.page.waitForTimeout(1_700);
    await harness.page.locator("[data-continue]").click().catch(() => undefined);
    await harness.page.waitForTimeout(2_000);
  }
  throw new Error("The store kept answering with its browser check.");
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

function pageOf(url: string): number {
  return Number(new URL(url).searchParams.get("page") ?? "1");
}

/** Next page as the worker sends it, carried into the new document when the press loads one. */
async function nextPage(harness: ContentHarness, item: string): Promise<BrowserActionResult> {
  const action: BrowserActionCommand = { commandId: "next-page-covered", actionType: "web.dom.next_page", timeoutMs: 30_000, nextPage: { item } };
  const sent = await harness.deliver({ type: "executeAction", topFrameOnly: true, extraction: { token: TOKEN }, action }).catch(() => undefined);
  if (sent?.responded) return sent.response as BrowserActionResult;
  for (let attempt = 1; ; attempt += 1) {
    await harness.page.waitForLoadState("load");
    try {
      const asked = await harness.deliver({ type: "executeAction", topFrameOnly: true, extraction: { token: TOKEN, resume: { by: "next" } }, action });
      expect(asked.responded, "the document the press loaded answered for it").toBe(true);
      return asked.response as BrowserActionResult;
    } catch (error) {
      if (attempt >= 5 || !/Execution context was destroyed/u.test(String(error))) throw error;
      await harness.page.waitForTimeout(250);
    }
  }
}

test("Next page under the deal wheel closes the wheel by its own way out, then follows Next", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await apply(harness, "set-mode", { mode: "deal-wheel" });
  await openSearch(harness);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect(page.locator(WHEEL)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const { proposal } = await detect(harness);

  await nextPage(harness, proposal.item);

  const state = (await harness.finalState()).state as unknown as { nudges: { dealWheel: string } };
  expect(state.nudges.dealWheel, "the wheel was answered by its way out before the pager was followed").toBe("dismissed");
  expect(pageOf(page.url())).toBe(2);
});

test("Next page under a dialog that offers no way out presses nothing and says the control is covered", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await page.waitForTimeout(1_500);
  const { proposal } = await detect(harness);
  // A modal layer with nothing on it to press, over the whole page, as a verification wall draws one.
  await page.evaluate(() => {
    const layer = document.createElement("div");
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Checking your browser");
    layer.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);color:#fff;display:flex;align-items:center;justify-content:center";
    layer.textContent = "Checking your browser before you continue";
    document.body.append(layer);
  });

  const reply = await harness.runAction({ commandId: "next-page-covered", actionType: "web.dom.next_page", timeoutMs: 20_000, nextPage: { item: proposal.item } });

  expect(reply.status).toBe("failed");
  expect(reply.nextPage).toMatchObject({ outcome: "failed", stop: "control_not_clickable" });
  expect(pageOf(page.url()), "nothing was pressed").toBe(1);
});
