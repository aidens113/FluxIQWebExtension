// A thread read while its replies are still closed says so (t762, from t755's
// "Not done": nothing told the builder that a read of the giveaway thread, every
// batch loaded, held the comments and none of the replies behind their "View
// replies" controls).
//
// The thread's way on comes first: while its Load more is on screen the read
// says `load_more_control`. Once the thread is whole, each comment that has
// replies still carries a closed toggle, and the read says `unopened_replies`.
// With every toggle opened the toggles read "Hide replies" and the read says
// nothing: the list is whole.

import type { WebAutomationExtractListRequest, WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const GIVEAWAY = "/scenarios/photo-social/p/D96ahbWGjtY/";
const LOAD_MORE = 'main article [role="button"]:has(> svg[aria-label="Load more comments"])';
const AUTHOR = "main article ul > li h3 a";
const CLOSED_TOGGLE = 'main article ul > li > [role="button"]:text-matches("^View replies")';

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
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: { selector: AUTHOR } });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

async function read(harness: ContentHarness, item: string): Promise<BrowserActionResult> {
  const request: WebAutomationExtractListRequest = { item, fields: { author: { kind: "text", selector: "h3 a" }, comment: { kind: "text", selector: 'span[dir="auto"]' } } };
  const reply = await harness.runAction({ commandId: `read-${Date.now()}`, actionType: "web.dom.extract_list", extractList: request });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  return reply;
}

test("a thread read with closed replies says so once its own Load more is gone, and says nothing once they are open", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("photo-social");
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await page.goto(new URL(GIVEAWAY, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const collapse = page.locator(`fl-dock [part="collapse-button"]`);
  await collapse.waitFor({ timeout: 9_000 });
  await collapse.click();
  await expect(page.locator(LOAD_MORE)).toBeVisible();
  const { item } = (await detect(harness)).proposal;

  // The thread still goes on by its Load more: that is the way on said.
  expect((await read(harness, item)).extraction?.listContinues).toEqual({ kind: "load_more", evidence: "load_more_control" });

  // Every batch loaded, the replies are still behind their toggles.
  // The thread swallows its first press and loads a batch on each after it, so a press is made, then waited on.
  for (let press = 0; press < 10 && (await page.locator(LOAD_MORE).count()) > 0; press += 1) {
    await page.locator(LOAD_MORE).click();
    await page.waitForTimeout(1_500);
  }
  await expect(page.locator(LOAD_MORE)).toHaveCount(0);
  expect(await page.locator(CLOSED_TOGGLE).count()).toBeGreaterThan(0);
  expect((await read(harness, item)).extraction?.listContinues).toEqual({ kind: "load_more", evidence: "unopened_replies" });

  // Opened, none is left to say.
  for (let left = await page.locator(CLOSED_TOGGLE).count(); left > 0; left = await page.locator(CLOSED_TOGGLE).count()) {
    await page.locator(CLOSED_TOGGLE).first().click();
    await expect(page.locator(CLOSED_TOGGLE)).toHaveCount(left - 1, { timeout: 8_000 });
  }
  const reopened = (await detect(harness)).proposal.item;
  expect((await read(harness, reopened)).extraction?.listContinues).toBeUndefined();
});
