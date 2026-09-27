import type { Page } from "@playwright/test";
import { pollStatus } from "../../run-lifecycle/index.js";

/**
 * Brings the fixture's tab to the front through the extension's own tab API,
 * and waits until the extension reports that tab as the one it holds.
 *
 * It matters that both halves happen here. The extension only automates the tab
 * it considers active, so a run whose fixture tab is not active records nothing
 * and executes nothing; and `chrome.tabs.update` resolves before the extension's
 * own status has caught up, so a run that activated the tab and moved on could
 * still ask the extension to record while it believed it held the side panel's
 * own page. The wait is on the extension's reported `activeTabId` *and*
 * `activeTabUrl`, because an id alone can belong to a tab that has since
 * navigated away from the fixture.
 */
export async function activateScenarioTab(extensionPage: Page, scenarioOrigin: string): Promise<void> {
  const tabId = await extensionPage.evaluate(async (origin: string) => {
    const tabs = await (globalThis as any).chrome.tabs.query({ url: `${origin}/*` });
    const tab = tabs.find((candidate: any) => typeof candidate.id === "number");
    if (!tab) throw new Error(`Scenario tab is unavailable for ${origin}`);
    await (globalThis as any).chrome.tabs.update(tab.id, { active: true });
    return tab.id as number;
  }, scenarioOrigin);
  await pollStatus(extensionPage, value => value.activeTabId === tabId && typeof value.activeTabUrl === "string" && value.activeTabUrl.startsWith(scenarioOrigin));
}
