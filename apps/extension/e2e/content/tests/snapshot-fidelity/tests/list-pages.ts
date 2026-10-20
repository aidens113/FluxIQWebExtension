// The page with a repeating list the spike measures on each realistic site,
// and how to reach it settled. Only the ten realistic Scenario Lab scenarios
// are used (AGENTS.md); these four were chosen by the plan's P5 gate (photo,
// job and social traces) plus a store.

import { expect } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

export type ListPage = { scenarioId: string; open(harness: ContentHarness): Promise<void> };

export const LIST_PAGES: ListPage[] = [
  {
    // The results list, with the consent wall (a shadow-DOM custom element) still open.
    scenarioId: "job-board",
    open: async (harness) => {
      await harness.page.goto(new URL("/scenarios/job-board/jobs", harness.url).href);
      await expect(harness.page.locator("article[data-jk]").first()).toBeAttached({ timeout: 10_000 });
    }
  },
  {
    // The home feed's posts, as the harness opens it.
    scenarioId: "photo-social",
    open: async (harness) => {
      await expect(harness.page.locator("main article").first()).toBeAttached({ timeout: 10_000 });
    }
  },
  {
    // The feed with consent, notifications and chat answered through the Lab, as social-read-completion.spec.ts does,
    // and every post's "See more" pressed: a read refuses a post whose text is still collapsed (incomplete_text).
    scenarioId: "social-network-feed",
    open: async (harness) => {
      for (const [operation, payload] of [["consent", { choice: "all" }], ["notifications", { choice: "dismissed" }], ["chat", { state: "closed" }]] as const) {
        const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
          method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload)
        });
        expect(response.ok).toBe(true);
      }
      await harness.page.reload();
      await expect(harness.page.locator('[data-ad-comet-preview="message"]').first()).toBeVisible({ timeout: 10_000 });
      await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
      const more = harness.page.getByRole("button", { name: "See more", exact: true });
      for (let pressed = 0; pressed < 30 && await more.count() > 0; pressed += 1) {
        await more.first().click();
        await harness.page.waitForTimeout(150);
      }
      await expect(more).toHaveCount(0);
    }
  },
  {
    // Search results, past the store's browser check, as everything-store-extraction.spec.ts reaches them.
    scenarioId: "everything-store",
    open: async (harness) => {
      const url = new URL("/scenarios/everything-store/s?k=wireless+earbuds&rh=plus", harness.lab.origin).href;
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
  }
];
