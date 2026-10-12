// `web.dom.type` sets a box by typing over what it holds, on the real
// crossborder item page (t423). R4a's second paid run
// (`run-mv2pgqkj-f3552c70`) set the quantity with a clear step and then a
// typing step. The page puts "1" back in the box whenever it is committed
// empty, so the clear step failed `output_not_observed` four times and the
// build looped on it. Typing has always replaced the box's content
// (`src/content/action-runtime/keyboard/type-text.ts`) and commits once, with
// the new value, so it is the one step that sets the box. The oracle is the
// box itself and the Scenario Lab's own cart, never the reply alone.
//
// Selectors are written by hand: this proves the verb on this page, not how a
// model addresses the controls.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import { expect, test } from "../../../index.js";

const market = marketClasses(7342, "baseline");
const OFFICIAL = "1005008123450";
const BOX = `.${market.qtyInput}`;

type MarketState = { cart: Array<{ listingId: string; quantity: number }> };

const actualOf = (reply: BrowserActionResult): string => (reply.validation.status === "none" ? "" : reply.validation.actual);

/** An exact CSS path, by child position from the body, to the option in the group whose label starts with `group`, titled or worded `value`. */
async function optionPath(page: Page, group: string, value: string): Promise<string> {
  const classes = { skuGroup: market.skuGroup, skuLabel: market.skuLabel, swatches: market.swatches };
  const path = await page.evaluate(({ names, groupName, optionValue }) => {
    const option = Array.from(document.querySelectorAll(`.${names.skuGroup}`))
      .filter((g) => (g.querySelector(`.${names.skuLabel}`)?.textContent ?? "").startsWith(groupName))
      .flatMap((g) => Array.from(g.querySelector(`.${names.swatches}`)?.children ?? []))
      .find((o) => (o.getAttribute("title") ?? o.textContent ?? "").trim() === optionValue);
    if (!option) return null;
    const parts: string[] = [];
    for (let node: Element | null = option; node && node !== document.body; node = node.parentElement) {
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.from(node.parentElement!.children).indexOf(node) + 1})`);
    }
    return `body > ${parts.join(" > ")}`;
  }, { names: classes, groupName: group, optionValue: value });
  if (!path) throw new Error(`no ${group} option ${value}`);
  return path;
}

/** Every key and edit event reaching the box, in order, each with its input type and the value it left. */
async function watchBox(page: Page): Promise<() => Promise<string[]>> {
  await page.locator(BOX).evaluate((element) => {
    const seen: string[] = [];
    (window as unknown as { __boxSeen: string[] }).__boxSeen = seen;
    for (const type of ["beforeinput", "input", "change"]) {
      element.addEventListener(type, (event) => {
        const inputType = event instanceof InputEvent ? `:${event.inputType}` : "";
        seen.push(`${event.type}${inputType}=${(element as HTMLInputElement).value}`);
      });
    }
  });
  return () => page.evaluate(() => (window as unknown as { __boxSeen: string[] }).__boxSeen);
}

test("crossborder: typing 3 over the quantity box's 1 sets it in one step and reaches the cart; clearing it first cannot be seen to work", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  await expect(page.locator(BOX)).toHaveValue("1");

  // The run's clear step: the page commits the empty box back to "1".
  const cleared = await harness.runAction({ commandId: "clear-quantity", actionType: "web.dom.clear", selector: BOX });
  expect(cleared.status, actualOf(cleared)).toBe("failed");
  // A notice the page raises may be closed first; the result then says so after the verdict.
  expect(cleared.validation).toMatchObject({ status: "failed", expected: "the field is empty", actual: expect.stringMatching(/^the field holds "1"/u) });
  await expect(page.locator(BOX)).toHaveValue("1");

  // The one step: type the new value over the old.
  const seen = await watchBox(page);
  const typed = await harness.runAction({ commandId: "type-quantity", actionType: "web.dom.type", selector: BOX, text: "3" });
  expect(typed.status, actualOf(typed)).toBe("succeeded");
  expect(typed.validation).toMatchObject({ status: "passed", expected: 'the field holds "3"', actual: expect.stringMatching(/^the field holds "3"/u) });
  // The old value is deleted as a selection typed over is, and the box is committed once, already holding the new one.
  expect(await seen()).toEqual(["beforeinput:deleteContentBackward=1", "input:deleteContentBackward=", "beforeinput:insertText=", "input:insertText=3", "change=3"]);
  await page.waitForTimeout(500);
  await expect(page.locator(BOX), "the page kept the typed value").toHaveValue("3");

  for (const [group, value] of [["Color", "Space Grey"], ["Specification", "7-in-1"], ["Ships From", "Spain"]] as const) {
    const reply = await harness.runAction({ commandId: `choose-${value}`, actionType: "web.dom.check", selector: await optionPath(page, group, value), checked: true });
    expect(reply.status, `choose ${value}: ${actualOf(reply)}`).toBe("succeeded");
  }
  await expect(page.locator(BOX), "choosing options left the quantity alone").toHaveValue("3");
  const added = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: `[data-testid="add-to-cart"]` });
  expect(added.status, actualOf(added)).toBe("succeeded");
  await expect.poll(async () => (await state()).cart.map((line) => line.quantity), { timeout: 5_000 }).toEqual([3]);
});
