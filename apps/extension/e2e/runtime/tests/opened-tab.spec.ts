// `web.dom.click` on a link that opens its page in a tab of its own, in a real
// Chromium with the real extension loaded (T3), against crossborder-
// marketplace's results page, whose cards are `target="_blank"` links.
//
// Until 2026-10-01 the click reported only that a navigation began; the tab it
// was pressed in never moved, and every later step, in the build and in
// playback, ran on the results page while the item sat in a tab nothing drove
// (lane A, `t174-w32`). The worker now drives the tab the click opened and says
// so. What this cannot show is a person's Chrome blocking that tab as a popup:
// Playwright launches Chromium with popup blocking off.

import { randomBytes } from "node:crypto";
import { startScenarioLab } from "../../../../scenario-lab/src/server.js";
import { marketClasses } from "../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";
import type { ExtensionSession } from "../../fixtures/extension-context.js";

/** The scenario's own seed, which the page's class names are drawn from. */
const SEED = 7342;
const market = marketClasses(SEED, "baseline");
const RESULTS = "/scenarios/crossborder-marketplace/search?q=usb+c+hub";
const ITEM_PATH = "/scenarios/crossborder-marketplace/item/1005008123450";
const CARD_TITLE = `a[href="${ITEM_PATH}"] > .${market.cardTitle}`;

/** Chrome's id for the tab showing `url`, read the way the panel reads it. */
function tabIdFor(session: ExtensionSession, url: string): Promise<number> {
  return session.extensionPage.evaluate(async (wanted) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === wanted);
    if (typeof tab?.id !== "number") throw new Error(`No tab is showing ${wanted}`);
    return tab.id;
  }, url);
}

const pathOf = (url: string | undefined): string => (url ? new URL(url).pathname : "");

test("click: a card that opens its item in a new tab hands the run that tab, and the next step drives the item", async ({ extensionSession }) => {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: SEED });
  try {
    const page = await extensionSession.context.newPage();
    await page.goto(new URL(RESULTS, lab.origin).href);
    await expect(page.locator(CARD_TITLE).first()).toBeVisible({ timeout: 8_000 });
    const resultsUrl = page.url();
    const clickedTab = await tabIdFor(extensionSession, resultsUrl);
    await installRuntimeHarness(extensionSession.extensionPage);
    await resetRuntimeHarness(extensionSession.extensionPage, clickedTab);

    const press = await runWorkerAction(extensionSession.extensionPage, {
      commandId: "open-card",
      actionType: "web.dom.click",
      selector: CARD_TITLE
    }, { activeTabId: clickedTab });

    expect(press.result.status, press.result.message).toBe("succeeded");
    expect(press.tabId, "the result names the tab the click opened").not.toBe(clickedTab);
    expect(press.result.validation).toMatchObject({ status: "passed" });
    expect(press.result.validation.status === "passed" ? press.result.validation.actual : "").toContain(
      `its page opened in a new tab (${ITEM_PATH}), which the run now drives`
    );
    expect(pathOf(press.result.url)).toBe(ITEM_PATH);
    expect(page.url(), "the tab the card was pressed in still shows the results").toBe(resultsUrl);

    // The next command names no tab: it goes to the tab the run drives.
    const look = await runWorkerAction(extensionSession.extensionPage, { commandId: "look", actionType: "web.dom.capture_snapshot" });
    expect(look.tabId).toBe(press.tabId);
    expect(look.result.status, look.result.message).toBe("succeeded");
    expect(pathOf(look.result.snapshot?.url ?? look.result.url)).toBe(ITEM_PATH);
  } finally {
    await lab.close();
  }
});
