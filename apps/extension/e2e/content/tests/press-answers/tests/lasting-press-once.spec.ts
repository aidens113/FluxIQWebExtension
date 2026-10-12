// A committing press is made once, however slowly the server answers it
// (t465), on social-network-feed through the real content-script and
// page-world bundles (T2 harness: no background worker, no Core, no model).
//
// The friend-request Confirm awaits its request before it changes the card. In
// playback of `run-mv5jnc5m-a47c3e59` the server took longer than the
// ignored-press window, the press read as ignored because a request was seen
// only once its response ended, and Confirm was pressed a second time: two
// confirm requests, two "Request accepted" lines, and two of the site's three
// confirms per window spent on one card. The page world now counts a request
// as the page begins it. The oracle is the page's own traffic -- how many
// confirm requests reached the network -- and the card, never the reply alone.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const ROOT = "/scenarios/social-network-feed/";

/** Longer than the click verb's 800 ms ignored-press window. */
const SLOW_SERVER_MS = 2_000;

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

const card = (person: string): string => `[role="listitem"]:has(a[href$="/people/${person}/"])`;

test("a Confirm whose server answers after the ignored-press window is pressed once, not twice", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("social-network-feed");
  await apply(harness, "consent", { choice: "all" });
  await apply(harness, "notifications", { choice: "dismissed" });
  await apply(harness, "chat", { state: "closed" });

  let confirms = 0;
  await page.route(`**/api/${harness.scenarioId}/confirm-request`, async (route) => {
    confirms += 1;
    await new Promise((resolve) => setTimeout(resolve, SLOW_SERVER_MS));
    await route.continue();
  });
  await page.goto(new URL(`${ROOT}friends/requests/`, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);

  const confirm = `${card("amara-osei")} [aria-label="Confirm"]`;
  const reply = await harness.runAction({ commandId: "confirm-amara", actionType: "web.dom.click", selector: confirm, element: { selector: confirm } });
  expect(reply.status, actualOf(reply)).toBe("succeeded");
  expect(actualOf(reply)).not.toMatch(/pressed once more/u);

  await expect(page.locator(card("amara-osei")).getByText("Request accepted", { exact: true })).toHaveCount(1, { timeout: SLOW_SERVER_MS * 3 });
  expect(confirms, "confirm requests the page sent").toBe(1);
  expect(((await harness.finalState()).state as { requests: Record<string, string> }).requests["rq_8b41c7"]).toBe("confirmed");
});
