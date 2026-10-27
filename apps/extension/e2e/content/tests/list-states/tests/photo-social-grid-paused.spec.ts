// A profile grid that loads a screen at a time as it is scrolled, read one page
// while its loader is asking to wait: the read says the list paused, not ended.
//
// t756's trace of photo-social `august-over-1300` (`run-mvdi88yz-e444d594`):
// a one-page read of the studio's grid said nothing of the list going on --
// 12 items a second after load, 24 two seconds after -- while the grid showed
// "Please wait a few moments before you try again" under it and the account
// held 45 posts. The read's own reveal scrolled the grid's end, the grid's rate
// limit answered that scroll, nothing grew within the reveal's wait, and the
// list was taken for one that had ended, so the builder was told a 12- or
// 24-row read was the whole grid.
//
// A list goes on, ends, or is paused by the site (t755). Here the visitor's own
// two quick scrolls trip the grid's limit, as the read's reveal did live, so the
// notice stands under the grid before the read: what is held is the read's
// answer while it does, `listContinues` with `loader_asked_to_wait`, and not the
// still-growing word, since nothing grew. Once the pause is over, the notice's
// own Try again ends it.

import type { WebAutomationExtractField, WebAutomationExtractListRequest, WebAutomationStructureDetection } from "@fluxiq-web-extension/domain/client";
import { STUDIO } from "../../../../../../scenario-lab/src/scenarios/photo-social/data/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const PROFILE = `/scenarios/photo-social/${STUDIO}/`;
const NOTICE = "Please wait a few moments before you try again.";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

/** One site operation, sent as the site's own scripts send it. */
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

test("a one-page read of a grid whose loader asks to wait says the list paused, not ended", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("photo-social");
  await apply(harness, "consent", { choice: "essential" });
  await apply(harness, "notifications");
  await page.goto(new URL(PROFILE, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const collapse = page.locator(`fl-dock [part="collapse-button"]`);
  await collapse.waitFor({ timeout: 9_000 });
  await collapse.click();
  const structure = await detect(harness);
  const cells = page.locator(structure.proposal.item);
  const first = await cells.count();
  expect(first).toBeGreaterThan(0);

  // Two scrolls to the grid's end in quick succession: the second is refused with the notice.
  const toEnd = () => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1_600);
  await toEnd();
  await expect.poll(() => cells.count(), { timeout: 5_000 }).toBeGreaterThan(first);
  await toEnd();
  await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 3_000 });
  const shown = await cells.count();

  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  const request: WebAutomationExtractListRequest = { item: structure.proposal.item, fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])) };
  const reply = await harness.runAction({ commandId: "read-paused-grid", actionType: "web.dom.extract_list", extractList: request });

  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
  expect(reply.extraction?.itemsSeen ?? reply.extraction?.recordCount).toBe(shown);
  expect(reply.extraction?.listContinues).toEqual({ kind: "infinite_scroll", evidence: "loader_asked_to_wait" });

  // The pause is the site's, and its own Try again ends it: the notice goes and the grid asks for its next part.
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await retry.waitFor({ timeout: 8_000 });
  await retry.click();
  await expect(page.getByText(NOTICE)).toHaveCount(0);
});
