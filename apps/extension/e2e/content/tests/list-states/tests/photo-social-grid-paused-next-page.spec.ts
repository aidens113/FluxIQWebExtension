// `web.dom.next_page` on a profile grid whose loader is asking to wait: the list
// is paused, not ended (t762, from t755's paused-list word).
//
// The studio's grid loads a screen at a time as it is scrolled, and answers a
// second request inside a moment and a half with a spinner, "Please wait a few
// moments before you try again", a countdown and, once it has run out, a Try
// again control. Until 2026-10-27 a Next page met by that notice scrolled the
// grid, saw nothing grow and answered `ended: scrolled_to_end` with the notice
// on screen, so a loop over it left with the grid half read. Now the step waits
// as the notice asks, presses the Try again it offers once it shows, and moves.
//
// Here the visitor's own two quick scrolls trip the limit, so the notice stands
// when the step starts.

import type { WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { STUDIO } from "../../../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const PROFILE = `/scenarios/photo-social/${STUDIO}/`;
const NOTICE = "Please wait a few moments before you try again.";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: { selector: `main a[href*="/p/"]` } });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

test("Next page met by the grid's wait notice waits it out and moves, and does not answer ended", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("photo-social");
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await page.goto(new URL(PROFILE, harness.lab.origin).href, { waitUntil: "load" });
  // The grid answers a second screen asked for within a moment and a half of its first with its notice: a scroll straight after load asks for it.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 3_000 });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const structure = await detect(harness);
  const cells = page.locator(structure.proposal.item);
  const paused = await cells.count();

  // The list carries no way of its own here: the step scrolls for more, as a loop over a grid does.
  const reply = await harness.runAction({ commandId: "next-page-paused-grid", actionType: "web.dom.next_page", timeoutMs: 60_000, nextPage: { item: structure.proposal.item } });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  expect(JSON.stringify(reply.nextPage), "the paused list was not ended").toContain(`"moved"`);
  expect(await cells.count()).toBeGreaterThan(paused);
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});
