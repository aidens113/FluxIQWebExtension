// Follow is a stored state with a visible face (t777): pressing it through the
// extension's own action stores the follow and the button reads "Following";
// both survive a reload; pressing again reverts both.

import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const PROFILE = "/scenarios/professional-network/in/aylin-demir-a281b6/";

async function post(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

const following = async (harness: ContentHarness) => ((await harness.finalState()).state as { following: string[] }).following;

test("professional-network: Follow is stored, reads Following, persists across a reload and reverts on unfollow", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("professional-network");
  await post(harness, "set-consent", { choice: "accepted" });
  const { page } = harness;
  await page.goto(new URL(PROFILE, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  // The extension's actions take CSS; the profile's main button is the first in its action row, and what it reads is checked by text.
  const ROW_BUTTON = `div[style*="margin-top:12px"] > button:first-child`;
  const primary = (label: string) => `button:text-is("${label}")`;
  await expect(page.locator(primary("Follow"))).toBeVisible();
  expect(await following(harness)).toEqual([]);

  const press = async () => {
    const reply = await harness.runAction({ commandId: `press-${Date.now()}`, actionType: "web.dom.click", selector: ROW_BUTTON });
    expect(reply.status, JSON.stringify(reply).slice(0, 600)).toBe("succeeded");
  };
  await press();
  await expect(page.locator(primary("Following"))).toBeVisible();
  expect(await following(harness)).toHaveLength(1);

  await page.reload({ waitUntil: "load" });
  await expect(page.locator(primary("Following"))).toBeVisible();
  expect(await following(harness)).toHaveLength(1);

  await press();
  await expect(page.locator(primary("Follow"))).toBeVisible();
  expect(await following(harness)).toEqual([]);
  await page.reload({ waitUntil: "load" });
  await expect(page.locator(primary("Follow"))).toBeVisible();
});
