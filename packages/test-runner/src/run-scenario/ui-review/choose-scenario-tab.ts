import type { BrowserContext, Page } from "@playwright/test";
import { withTimeout } from "./with-timeout.js";

export type ChosenScenarioTab = { page: Page; documentVisibility?: string; inFront: boolean | "unknown"; frontTabs: string[] };

/**
 * The tab the review photographs and samples as "the scenario tab": the web
 * tab the browser has in front, as the extension's `chrome.tabs.query({ active:
 * true })` reports it, preferring the run's own tab when it is one of those.
 * When no web tab is in front, the run's own tab (or the newest web tab, if
 * the run's own is blank) is chosen and `inFront` says it is not in front.
 *
 * `document.visibilityState` cannot choose it: every tab reported `visible` in
 * the validation runs, including the blank tab each persistent context opens
 * with, which the first run (run-munnkaw7-35695cdd) photographed instead of
 * the fixture. A headed Chromium paints only the tab in front, so a picture of
 * any other one times out. Nothing is brought to the front to fix that:
 * activating a tab is an event the extension acts on.
 */
export async function chooseScenarioTab(context: BrowserContext, own: Page, controlPage: Page): Promise<ChosenScenarioTab> {
  const showsWebPage = (page: Page) => !page.isClosed() && /^https?:/u.test(page.url());
  const front = await withTimeout(controlPage.evaluate(async () => {
    const tabs: Array<{ url?: string }> = await (globalThis as any).chrome.tabs.query({ active: true });
    return tabs.map(tab => tab.url ?? "");
  }), 1_000, "the browser's active tabs").catch((error: unknown) => new Error(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error)));
  const frontUrls = front instanceof Error ? undefined : front;
  const inFront = (page: Page) => frontUrls?.includes(page.url()) === true;
  const web = [...context.pages()].reverse().filter(showsWebPage);
  const page = showsWebPage(own) && (frontUrls === undefined || inFront(own)) ? own : web.find(inFront) ?? (showsWebPage(own) ? own : web[0] ?? own);
  const frontTabs = frontUrls ?? [`unreadable: ${(front as Error).message}`];
  if (page.isClosed()) return { page, inFront: false, frontTabs };
  const documentVisibility = await withTimeout(page.evaluate(() => document.visibilityState), 1_000, "the tab's visibility").catch((error: unknown) => `unreadable: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  return { page, documentVisibility, inFront: frontUrls === undefined ? "unknown" : inFront(page), frontTabs };
}
