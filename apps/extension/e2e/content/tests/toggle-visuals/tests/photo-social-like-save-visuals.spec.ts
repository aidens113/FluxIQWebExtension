// A toggle shows its state the way a real photo site does (t777): a liked
// heart is filled red and a saved bookmark filled solid, after the extension's
// own click once the server has the act, and again on reload; undoing reverts
// the server state, the fill and the like count. Checked on a post's own page,
// on a feed card and in the profile grid's post modal.

import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const CODE = "D1OKDvAEHfa";
const POST = `/scenarios/photo-social/p/${CODE}/`;
const FEED = "/scenarios/photo-social/";
const PROFILE = "/scenarios/photo-social/harbourlight.studio/";
const RED = "rgb(255, 48, 64)";

type Where = { scope: string; open: (harness: ContentHarness) => Promise<string> };
const button = (scope: string, label: string) => `${scope} section > [role="button"]:has(> svg[aria-label="${label}"])`;
const likesOf = (scope: string) => `${scope} section a[href$="/liked_by/"] > span`;

async function post(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

async function stored(harness: ContentHarness): Promise<{ liked: string[]; saved: string[] }> {
  return (await harness.finalState()).state as { liked: string[]; saved: string[] };
}

const fillOf = (page: Page, scope: string, label: string) => page.locator(`${scope} section svg[aria-label="${label}"] path`).first().evaluate((path) => getComputedStyle(path).fill);

async function ready(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href, { waitUntil: "load" });
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  const collapse = harness.page.locator(`fl-dock [part="collapse-button"]`);
  await collapse.waitFor({ timeout: 9_000 });
  await collapse.click();
}

async function press(harness: ContentHarness, selector: string): Promise<void> {
  const reply = await harness.runAction({ commandId: `press-${Date.now()}`, actionType: "web.dom.click", selector });
  expect(reply.status, JSON.stringify(reply.validation)).toBe("succeeded");
}

const MODAL = "the grid's post modal";
const WHERE: Record<string, Where> = {
  "a post's own page": {
    scope: "main article",
    open: async (harness) => {
      await ready(harness, POST);
      return CODE;
    }
  },
  "a feed card": {
    scope: "",
    open: async (harness) => {
      await ready(harness, FEED);
      const href = await harness.page.locator("main article a[href*='/p/']").first().getAttribute("href");
      return /\/p\/([A-Za-z0-9_-]+)\//u.exec(href ?? "")![1]!;
    }
  },
  [MODAL]: {
    scope: `[role="dialog"] article`,
    open: async (harness) => {
      await ready(harness, PROFILE);
      await harness.page.locator(`a[href$="/p/${CODE}/"]`).first().click();
      await expect(harness.page.locator(`[role="dialog"] article section`).first()).toBeVisible();
      return CODE;
    }
  }
};

for (const [name, where] of Object.entries(WHERE)) {
  test(`photo-social: on ${name} a liked heart and a saved bookmark look so after the click and after a reload, and revert when undone`, async ({ openHarness }) => {
    test.setTimeout(150_000);
    const harness = await openHarness("photo-social");
    await post(harness, "consent", { choice: "essential" });
    await post(harness, "notifications");
    const code = await where.open(harness);
    const { page } = harness;
    const scope = where.scope === "" ? `main article:has(a[href*="/p/${code}/"])` : where.scope;
    const reopen = async () => {
      // The modal's address is the post's own, so a reload shows the post page; reopening is a return to the grid.
      if (name === MODAL) {
        await page.goto(new URL(PROFILE, harness.lab.origin).href, { waitUntil: "load" });
        await page.locator(`a[href$="/p/${code}/"]`).first().click();
        await expect(page.locator(`${scope} section`).first()).toBeVisible();
      } else await page.reload({ waitUntil: "load" });
    };
    const counted = (await page.locator(likesOf(scope)).count()) > 0;
    const before = counted ? Number((await page.locator(likesOf(scope)).first().innerText()).replace(/,/g, "")) : 0;
    expect(await fillOf(page, scope, "Like")).toBe("none");

    await press(harness, button(scope, "Like"));
    await expect(page.locator(button(scope, "Unlike"))).toBeVisible();
    expect(await fillOf(page, scope, "Unlike")).toBe(RED);
    expect((await stored(harness)).liked).toContain(code);
    if (counted) await expect(page.locator(likesOf(scope)).first()).toHaveText((before + 1).toLocaleString("en-US"));

    await press(harness, button(scope, "Save"));
    await expect(page.locator(button(scope, "Remove"))).toBeVisible();
    expect(await fillOf(page, scope, "Remove")).not.toBe("none");
    expect((await stored(harness)).saved).toContain(code);

    await reopen();
    await expect(page.locator(button(scope, "Unlike"))).toBeVisible();
    expect(await fillOf(page, scope, "Unlike")).toBe(RED);
    expect(await fillOf(page, scope, "Remove")).not.toBe("none");
    if (counted) await expect(page.locator(likesOf(scope)).first()).toHaveText((before + 1).toLocaleString("en-US"));

    await press(harness, button(scope, "Unlike"));
    await expect(page.locator(button(scope, "Like"))).toBeVisible();
    expect(await fillOf(page, scope, "Like")).toBe("none");
    expect((await stored(harness)).liked).not.toContain(code);
    if (counted) await expect(page.locator(likesOf(scope)).first()).toHaveText(before.toLocaleString("en-US"));

    await press(harness, button(scope, "Remove"));
    await expect(page.locator(button(scope, "Save"))).toBeVisible();
    expect(await fillOf(page, scope, "Save")).toBe("none");
    expect((await stored(harness)).saved).not.toContain(code);
  });
}
