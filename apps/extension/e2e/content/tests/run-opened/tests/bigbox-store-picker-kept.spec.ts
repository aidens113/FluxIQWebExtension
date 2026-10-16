// The layer a click of the run opened is the Flow's own, through the real
// content-script bundle on bigbox-retail (T2 harness: no background worker, no
// Core, no model). The oracle is the page and the Scenario Lab's own state.
//
// bigbox-retail's cart Flow failed six trials of eight and its playback on this
// (`run-mvac0ddx-f52ba929`, t656): the email offer, shown 2.2 s after consent
// is answered, came up over the store chip, so the chip's click closed it and
// opened the store picker; the optional "No thanks" step that followed found
// its offer already gone, and the clearing for that missing target closed the
// picker, so "Set as my store" had no box. Here the offer is waited for, so the
// race the trials lost by chance is lost every time.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";

const actualOf = (reply: BrowserActionResult): string => (reply.validation.status === "none" ? "" : reply.validation.actual);

/** The picker's flyout is open: its first "Set as my store" button has a box. */
const flyoutOpen = (page: Page): Promise<boolean> => page.evaluate(() => {
  const root = document.querySelector("vr-fulfillment-picker")?.shadowRoot;
  const set = [...(root?.querySelectorAll("button") ?? [])].find((button) => button.textContent?.trim() === "Set as my store");
  return Boolean(set && set.getClientRects().length > 0);
});

/** Selectors for the chip and the first "Set as my store", each written within the picker's root, and for the offer's "No thanks". */
const selectors = (page: Page): Promise<{ chip: string; setStore: string; noThanks: string }> => page.evaluate(() => {
  const root = document.querySelector("vr-fulfillment-picker")!.shadowRoot!;
  const first = (element: Element | null | undefined): string => (element?.className ?? "").split(/\s+/u)[0] ?? "";
  const chip = root.querySelector("button")!;
  const set = [...root.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Set as my store")!;
  const card = set.closest("li")!;
  const row = [...card.parentElement!.children].indexOf(card) + 1;
  const decline = [...document.querySelectorAll("a")].find((link) => link.textContent?.trim() === "No thanks");
  return { chip: `button.${first(chip)}`, setStore: `li:nth-of-type(${row}) > button.${first(set)}`, noThanks: `a.${first(decline)}` };
});

test.describe("bigbox-retail: the store picker a click opened is kept for the step after", () => {
  test.setTimeout(90_000);

  test("the offer over the chip is closed, an absent No thanks closes nothing, and Set as my store lands", async ({ openHarness, page }) => {
    const harness = await openHarness("bigbox-retail");
    const before = (await harness.finalState()).state as { storeId: string };
    await page.getByRole("button", { name: "Reject all" }).click();
    await expect(page.getByText("No thanks"), "the offer opens 2.2 s after consent is answered").toBeVisible({ timeout: 10_000 });
    const { chip, setStore, noThanks } = await selectors(page);

    const opened = await harness.runAction({ commandId: "open-picker", actionType: "web.dom.click", selector: chip });
    expect(opened.status, `${opened.message} | ${actualOf(opened)}`).toBe("succeeded");
    expect(opened.clearedLayers?.length, "the offer over the chip was what got cleared").toBe(1);
    await expect(page.getByText("No thanks")).toHaveCount(0);
    expect(await flyoutOpen(page), "the chip's click opened the picker").toBe(true);

    const declined = await harness.runAction({ commandId: "decline-offer", actionType: "web.dom.click", selector: noThanks, timeoutMs: 1_500 });
    expect(declined.status).toBe("failed");
    expect(declined.failure?.code, "the offer is already gone").toBe("web.target.not_found");
    expect(declined.clearedLayers, `nothing is cleared for the missing target | ${declined.failure?.actual ?? ""}`).toBeUndefined();
    expect(await flyoutOpen(page), "the picker the previous step opened is still open").toBe(true);

    // Setting the store reloads the page, which can take the reply with it; the
    // site's own state is the oracle either way.
    const chosen = await harness.runAction({ commandId: "set-store", actionType: "web.dom.click", selector: setStore }).catch((error: unknown) => error);
    if (chosen instanceof Error) expect(chosen.message, "only the reload the press caused may take the reply").toMatch(/Execution context was destroyed|navigation/u);
    else expect((chosen as BrowserActionResult).status, `${(chosen as BrowserActionResult).message} | ${actualOf(chosen as BrowserActionResult)}`).toBe("succeeded");
    await expect.poll(async () => ((await harness.finalState()).state as { storeId: string }).storeId, "the store was set").not.toBe(before.storeId);
  });
});
