// `web.dom.next_page` on a profile grid that stops to check the session: the
// check is an interruption, never the list's end (t765).
//
// After the grid's rate-limit notice and its Try again, the studio's grid answers
// its third screen with "Your session needs a quick check before we load more"
// and a "Continue as <name>" control. Until 2026-10-27 a Next page met by that
// wall scrolled the grid, saw nothing grow and answered `ended: scrolled_to_end`
// with the wall on screen. Now the step presses the wall's plain way on and the
// next screen loads. Reached here only through the extension's own next-page
// steps, no press of ours.

import type { WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { STUDIO } from "../../../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const PROFILE = `/scenarios/photo-social/${STUDIO}/`;
const WALL = "Your session needs a quick check";
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

test("Next page met by the grid's session check presses its Continue and loads the next screen, never answering ended", async ({ openHarness, page }) => {
  test.setTimeout(180_000);
  const harness = await openHarness("photo-social");
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await page.goto(new URL(PROFILE, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const structure = await detect(harness);
  const cells = page.locator(structure.proposal.item);
  const first = await cells.count();
  // The wall is gone as soon as it is passed: record that it stood.
  await page.evaluate((words) => {
    const seen = window as unknown as { wallSeen?: boolean };
    new MutationObserver(() => { if (document.body.textContent?.includes(words)) seen.wallSeen = true; }).observe(document.body, { childList: true, subtree: true });
  }, WALL);

  // Three steps carry the grid through its rate limit and its session check to the third screen.
  for (let step = 1; step <= 4 && (await cells.count()) < first * 3; step += 1) {
    const reply = await harness.runAction({ commandId: `next-page-wall-${step}`, actionType: "web.dom.next_page", timeoutMs: 60_000, nextPage: { item: structure.proposal.item } });
    expect(reply.status, `step ${step}: ${JSON.stringify(reply.validation)}`).toBe("succeeded");
    expect(JSON.stringify(reply.nextPage), `step ${step}: the grid had not ended`).toContain(`"moved"`);
  }
  expect(await cells.count(), "the third screen loaded").toBeGreaterThanOrEqual(first * 3);
  await expect(page.getByText(WALL)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { wallSeen?: boolean }).wallSeen), "the session check stood on the way").toBe(true);
});
