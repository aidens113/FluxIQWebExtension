// A press that certainly did nothing is reported as such (t517), on
// social-network-feed's group composer through the real content-script and
// page-world bundles (T2 harness: no background worker, no Core, no model).
//
// The composer's Post takes its first press only as a wake-up: it spins for
// 450 ms, turns back into Post, and posts nothing; the second press posts
// (`client/composer-script.ts`). Until t517 the spinner read as the page's
// answer, so trials and playback passed the press with nothing posted
// (`run-mv6v2jh4-69244ffb`). Now the first press fails as
// `web.action.no_effect`, marked `certainNoEffect`, which Core makes once more;
// the second press here stands in for that one press more. The oracle is the
// page's own traffic -- how many group-post requests reached the network --
// and the group's pending box, never the reply alone.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const GROUP = "/scenarios/social-network-feed/groups/riverside-allotments/";
const TEXT = "Seed swap at the shed on Saturday morning, all welcome.";
const POST = '[role="dialog"] [role="button"][aria-label="Post"]';

const actualOf = (reply: BrowserActionResult): string =>
  reply.failure?.actual ?? (reply.validation.status === "none" ? "" : reply.validation.actual);

async function apply(harness: ContentHarness, operation: string, payload: object): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

test("a Post that only wakes on its first press is reported as certainly without effect, and the press made once more posts", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("social-network-feed");
  await apply(harness, "consent", { choice: "all" });
  await apply(harness, "notifications", { choice: "dismissed" });
  await apply(harness, "chat", { state: "closed" });

  let posts = 0;
  await page.route(`**/api/${harness.scenarioId}/group-post`, async (route) => {
    posts += 1;
    await route.continue();
  });
  await page.goto(new URL(GROUP, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);

  // Setting up the composer is not what is under test, so a person's hands do it.
  await page.locator('[data-testid="group-composer-prompt"]').click();
  await page.locator('[role="dialog"] [contenteditable="true"]').pressSequentially(TEXT);
  await expect(page.locator(POST)).toHaveAttribute("aria-disabled", "false");

  const first = await harness.runAction({ commandId: "post-1", actionType: "web.dom.click", selector: POST, element: { selector: POST } });
  expect(first.status, actualOf(first)).toBe("failed");
  expect(first.failure).toMatchObject({ code: "web.action.no_effect", retryable: true, effect: "unacted", certainNoEffect: true });
  expect(actualOf(first)).toMatch(/once it settled nothing on it had changed/u);
  expect(posts, "group-post requests after the first press").toBe(0);
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);

  const again = await harness.runAction({ commandId: "post-2", actionType: "web.dom.click", selector: POST, element: { selector: POST } });
  expect(again.status, actualOf(again)).toBe("succeeded");
  await expect.poll(() => posts, { timeout: 5_000 }).toBe(1);
  await expect(page.locator('[data-testid="pending-posts"]').getByText(TEXT)).toHaveCount(1, { timeout: 5_000 });
});
