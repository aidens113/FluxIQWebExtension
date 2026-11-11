// The hover verb on a menu only a stylesheet's `:hover` rule opens (t903, F5).
//
// crossborder-marketplace draws its header's account menu with
// `.account:hover .flyout {display: block}`: no script opens it, and no event a
// script dispatches sets `:hover`, so six presses on `run-mwbkuxqt-c57f42cb`
// left it closed. `web.dom.hover` points at the control as a resting mouse does:
// it applies the page's own hover rules to the hovered element's chain, and is
// judged by what appeared. The state is temporary: the next action that acts
// ends it, it changes no other style, and the sheets are as they were after it.
// A hover that shows nothing is a failed validation, not a success.

import type { Page } from "@playwright/test";
import { MARKET_SEED } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/manifest/index.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import type { BrowserActionCommand, BrowserActionResult, DomElementDescriptor } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

let commandCount = 0;
const run = (harness: ContentHarness, action: Omit<BrowserActionCommand, "commandId">): Promise<BrowserActionResult> =>
  harness.runAction({ commandId: `hover-spec.${++commandCount}`, ...action } as BrowserActionCommand);

const words = (element: DomElementDescriptor): string => (element.visibleText ?? element.text ?? element.accessibleName ?? "").replace(/\s+/gu, " ").trim();

async function selectorOf(harness: ContentHarness, label: string): Promise<string> {
  const found = (await harness.capture()).interactiveElements.filter((element) => words(element) === label);
  expect(found, `the snapshot lists exactly one element named "${label}"`).toHaveLength(1);
  return found[0]!.selector;
}

/** The header's account control: the words over the name, in the one account box that holds the menu (the site's own classes). */
const c = marketClasses(MARKET_SEED, "baseline");
const ACCOUNT = `.${c.account}:has(.${c.flyout}) > span`;

/** Every rule of the page's own readable stylesheets, as text, to compare before and after. */
async function sheetRules(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const out: string[] = [];
    const walk = (rules: CSSRuleList): void => {
      for (const rule of Array.from(rules)) {
        out.push(rule.cssText);
        const inner = (rule as Partial<CSSGroupingRule>).cssRules;
        if (inner !== undefined && !("selectorText" in rule)) walk(inner);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        // Another origin's sheet is not the hover's to read either.
      }
    }
    return out;
  });
}

async function arrive(harness: ContentHarness): Promise<void> {
  expect((await run(harness, { actionType: "web.dom.wait_for_text", text: "Welcome back, Mara!", timeoutMs: 8_000 })).status).toBe("succeeded");
  for (const label of ["No thanks", "Accept all"]) {
    expect((await run(harness, { actionType: "web.dom.click", selector: await selectorOf(harness, label) })).status).toBe("succeeded");
  }
}

test("crossborder-marketplace: a hover on the account control opens its CSS-hover menu, and the next action closes it", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("crossborder-marketplace");
  await arrive(harness);
  const line = harness.page.getByTestId("followed-stores");
  await expect(line).toBeHidden();
  const before = await sheetRules(harness.page);

  const hovered = await run(harness, { actionType: "web.dom.hover", selector: ACCOUNT });
  expect(hovered.status, JSON.stringify(hovered.validation)).toBe("succeeded");
  expect(hovered.validation.status).toBe("passed");
  expect(String((hovered.validation as { actual?: string }).actual)).toMatch(/the hover showed \d+ elements? not shown before/u);
  await expect(line).toBeVisible();
  // The flyout's own lines show; the page's other styles are untouched (the copies only add rules for the chain).
  await expect(harness.page.getByTestId("orders-summary")).toBeVisible();

  // A read does not end the hover: a person reads an open menu without moving the mouse.
  expect((await run(harness, { actionType: "web.dom.capture_snapshot" })).status).toBe("succeeded");
  await expect(line).toBeVisible();

  // The next action that acts does, and the sheets are exactly as they were.
  const boxes = (await harness.capture()).interactiveElements.filter((element) => element.tagName.toLowerCase() === "input" && (element.name ?? element.attributes?.name) === "q");
  expect(boxes).toHaveLength(1);
  expect((await run(harness, { actionType: "web.dom.click", selector: boxes[0]!.selector })).status).toBe("succeeded");
  await expect(line).toBeHidden();
  expect(await sheetRules(harness.page)).toEqual(before);
});

test("crossborder-marketplace: a hover that shows nothing new is a failed validation, judged by what appeared", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("crossborder-marketplace");
  await arrive(harness);
  const boxes = (await harness.capture()).interactiveElements.filter((element) => element.tagName.toLowerCase() === "input" && (element.name ?? element.attributes?.name) === "q");
  expect(boxes).toHaveLength(1);
  const hovered = await run(harness, { actionType: "web.dom.hover", selector: boxes[0]!.selector });
  expect(hovered.status).toBe("failed");
  expect(hovered.failure?.code).toBe("web.validation.output_not_observed");
  expect(String((hovered.validation as { actual?: string }).actual)).toContain("nothing that was not shown before the hover was shown");
});
