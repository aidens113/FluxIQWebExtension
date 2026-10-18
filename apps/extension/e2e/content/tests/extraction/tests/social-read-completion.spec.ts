// Real content-script proof on the realistic feed. No model, background
// worker or Core executor: registered actions are delivered by the harness.
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

async function prepare(harness: ContentHarness): Promise<void> {
  for (const [operation, payload] of [["consent", { choice: "all" }], ["notifications", { choice: "dismissed" }], ["chat", { state: "closed" }]] as const) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload)
    });
    expect(response.ok).toBe(true);
  }
  await harness.page.reload();
  await expect(harness.page.locator('[data-ad-comet-preview="message"]').first()).toBeVisible();
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

test("partial feed text refuses without expansion; an explicit row-bound registered click makes the same field readable", async ({ openHarness, page }) => {
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  const partial = page.locator('[data-ad-comet-preview="message"]').filter({ has: page.getByRole("button", { name: "See more", exact: true }) }).first();
  await expect(partial).toBeVisible();
  const key = await partial.evaluate((element) => element.closest('[role="article"]')?.getAttribute("aria-posinset"));
  expect(key).toBeTruthy();
  const item = `[role="article"][aria-posinset="${key}"]`;
  const text = '[data-ad-comet-preview="message"]';
  const selected = page.locator(`${item} ${text}`);
  const read = { item, fields: { description: { kind: "text" as const, selector: text } } };
  const beforeLength = (await selected.innerText()).length;
  const detected = await harness.runAction({ commandId: "detect-collapsed", actionType: "web.dom.capture_snapshot", detectStructure: {} });
  expect(detected.status).toBe("succeeded");
  expect(detected.structure?.ok).toBe(true);
  await expect(selected.getByRole("button", { name: "See more", exact: true })).toBeVisible();
  const refused = await harness.runAction({ commandId: "read-partial", actionType: "web.dom.extract_list", extractList: read });
  expect(refused.status).toBe("failed");
  expect(refused.failure?.code).toBe("web.validation.output_not_observed");
  expect(refused.failure?.actual).toMatch(/incomplete_text.*registered row-bound click/u);
  expect(refused.extracted).toBeUndefined();
  await expect(selected.getByRole("button", { name: "See more", exact: true })).toBeVisible();
  expect((await selected.innerText()).length).toBe(beforeLength);
  const selector = `${item} ${text} [role="button"]`;
  const pressed = await harness.runAction({ commandId: "expand-selected-row", actionType: "web.dom.click", selector, element: { selector } });
  expect(pressed.status).toBe("succeeded");
  await expect(selected.getByRole("button", { name: "See more", exact: true })).toHaveCount(0);
  const complete = await harness.runAction({ commandId: "read-complete", actionType: "web.dom.extract_list", extractList: read });
  expect(complete.status, JSON.stringify({ failure: complete.failure, validation: complete.validation })).toBe("succeeded");
  expect(complete.validation.status).toBe("passed");
  const records = complete.extracted as Array<{ description: string }>;
  expect(records).toHaveLength(1);
  expect(records[0]!.description.length).toBeGreaterThan(beforeLength);
  expect(records[0]!.description).toBe((await selected.innerText()).replace(/\s+/gu, " ").trim());
});

test("repeated post renderings share an opted-in helper identity while requested raw links retain tracking", async ({ openHarness, page }) => {
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  for (let batch = 0; batch < 4; batch += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(650);
  }
  const reply = await harness.runAction({ commandId: "read-identities", actionType: "web.dom.extract_list", extractList: {
    item: '[role="article"] a[href*="/posts/"]', fields: { url: { kind: "link" }, identity: { kind: "link", identity: "tracking-free" } }
  } });
  expect(reply.status).toBe("succeeded");
  const rows = reply.extracted as Array<{ url: string; identity: string }>;
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const raw = new URL(row.url);
    const normalized = new URL(row.identity);
    expect(raw.searchParams.has("__tn__")).toBe(true);
    expect(normalized.searchParams.has("__tn__")).toBe(false);
    expect(normalized.pathname).toBe(raw.pathname);
    expect(normalized.hash).toBe(raw.hash);
  }
  expect(new Set(rows.map((row) => row.url)).size).toBeGreaterThan(new Set(rows.map((row) => row.identity)).size);
});
