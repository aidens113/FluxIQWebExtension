// `web.dom.check` on a control the page draws itself, on the real crossborder
// item page (t364). Lane A round 5 (`run-muz0f12h-eae63685`) stopped here: the
// colour swatches are `<div>`s, Space Grey arrives chosen and is shown only by
// a class the other swatches lack, a click toggles it off, and `check` refused
// it as not a checkbox, so no step could say "Space Grey, chosen" and be right
// however the page arrived. The oracle is the Scenario Lab's own server state
// (the cart) and the option group's label, never the reply alone.
//
// Selectors are written by hand: this proves the verb on this page, not how a
// model addresses the controls.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import { expect, test } from "../../../index.js";

const market = marketClasses(7342, "baseline");
const OFFICIAL = "1005008123450";

type MarketState = { cart: Array<{ listingId: string; choice: { color: string; spec: string; origin: string }; quantity: number }> };

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

/** The chosen value the option group's own label shows. */
async function shownChoice(page: Page, group: string): Promise<string> {
  return await page.evaluate(({ skuLabel, groupName }) => {
    const label = Array.from(document.querySelectorAll(`.${skuLabel}`)).find((l) => (l.textContent ?? "").startsWith(groupName));
    return label?.querySelector("b")?.textContent ?? "";
  }, { skuLabel: market.skuLabel, groupName: group });
}

test("crossborder: check on the preselected Space Grey swatch presses nothing, check on Silver chooses it once, and choices set by check reach the cart", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  // A first visit raises the chat pill, the welcome coupons and consent; the verb's
  // defence closes what covers a swatch, and its result then says so after the verdict.
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  expect(await shownChoice(page, "Color")).toBe("Space Grey");

  const spaceGrey = await optionPath(page, "Color", "Space Grey");
  const already = await harness.runAction({ commandId: "grey-already", actionType: "web.dom.check", selector: spaceGrey, checked: true });
  expect(already.status, actualOf(already)).toBe("succeeded");
  expect(already.validation).toMatchObject({ status: "passed", expected: "the option is chosen", actual: expect.stringMatching(/^the option is chosen \(drawn apart from the like options beside it\)/u) });
  expect(already.message).toBe("Option already chosen; nothing pressed.");
  expect(await shownChoice(page, "Color"), "a press would have un-chosen it").toBe("Space Grey");

  const silver = await optionPath(page, "Color", "Silver");
  const chosen = await harness.runAction({ commandId: "silver", actionType: "web.dom.check", selector: silver, checked: true });
  expect(chosen.status, actualOf(chosen)).toBe("succeeded");
  expect(chosen.validation).toMatchObject({ status: "passed", actual: expect.stringMatching(/^the option is chosen \(drawn apart from the like options beside it\)/u) });
  expect(await shownChoice(page, "Color")).toBe("Silver");
  const replay = await harness.runAction({ commandId: "silver-again", actionType: "web.dom.check", selector: silver, checked: true });
  expect(replay.message, actualOf(replay)).toBe("Option already chosen; nothing pressed.");
  expect(await shownChoice(page, "Color"), "the replay toggled nothing").toBe("Silver");

  // Round 5's trial, with every choice written as desired state.
  for (const [group, value] of [["Color", "Space Grey"], ["Specification", "7-in-1"], ["Ships From", "Spain"]] as const) {
    const reply = await harness.runAction({ commandId: `choose-${value}`, actionType: "web.dom.check", selector: await optionPath(page, group, value), checked: true });
    expect(reply.status, `choose ${value}: ${actualOf(reply)}`).toBe("succeeded");
    expect(await shownChoice(page, group)).toBe(value);
  }
  const added = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: `[data-testid="add-to-cart"]` });
  expect(added.status, actualOf(added)).toBe("succeeded");
  await expect.poll(async () => (await state()).cart.map((line) => `${line.choice.color} · ${line.choice.spec} · ${line.choice.origin}`), { timeout: 5_000 }).toEqual(["Space Grey · 7-in-1 · Spain"]);
});

test("crossborder: check on a control that shows no chosen state is refused with a sentence saying so, and presses nothing", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  const refused = await harness.runAction({ commandId: "add-as-check", actionType: "web.dom.check", selector: `[data-testid="add-to-cart"]`, checked: true });
  expect(refused.status, actualOf(refused)).toBe("failed");
  expect(refused.failure).toMatchObject({ code: "web.action.rejected", retryable: false });
  expect(refused.failure?.actual).toMatch(/^not_checkable: <div> shows no chosen state to read/u);
  await page.waitForTimeout(1_000);
  expect((await state()).cart, "nothing was pressed").toEqual([]);
});
