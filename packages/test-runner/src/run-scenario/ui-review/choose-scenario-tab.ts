import type { BrowserContext, Page } from "@playwright/test";
import { withTimeout } from "./with-timeout.js";

/** One tab open in the browser, unscreened; `inFront` is `unknown` when the browser's tabs could not be read. */
export type OpenTab = { url: string; inFront: boolean | "unknown" };
export type ChosenScenarioTab = { page: Page; documentVisibility?: string; inFront: boolean | "unknown"; frontTabs: string[]; openTabs: OpenTab[] };

/**
 * The tab the review photographs and samples as "the scenario tab": the web
 * tab the browser has in front, as the extension's `chrome.tabs.query` reports
 * it, preferring the run's own tab when it is one of those. When no web tab
 * is in front, the run's own tab (or the newest web tab, if the run's own is
 * blank) is chosen and `inFront` says it is not in front.
 *
 * `document.visibilityState` cannot choose it: every tab reported `visible` in
 * the validation runs, including the blank tab each persistent context opens
 * with, which the first run (run-munnkaw7-35695cdd) photographed instead of
 * the fixture. A headed Chromium paints only the tab in front, so a picture of
 * any other one times out. Nothing is brought to the front to fix that:
 * activating a tab is an event the extension acts on.
 *
 * Every open tab is listed as well (`openTabs`), with which one is in front:
 * one `chrome.tabs.query({})` answers both, and without it the tabs that build
 * up over a run were visible only in screenshots (run-musp8nz1, R7). When the
 * browser's tabs cannot be read, the pages the run's context holds are listed
 * instead, with front `unknown`.
 */
export async function chooseScenarioTab(context: BrowserContext, own: Page, controlPage: Page): Promise<ChosenScenarioTab> {
  const showsWebPage = (page: Page) => !page.isClosed() && /^https?:/u.test(page.url());
  const tabs = await withTimeout(controlPage.evaluate(async () => {
    const all: Array<{ url?: string; pendingUrl?: string; active?: boolean }> = await (globalThis as any).chrome.tabs.query({});
    return all.map(tab => ({ url: tab.url || tab.pendingUrl || "", active: tab.active === true }));
  }), 1_000, "the browser's tabs").catch((error: unknown) => new Error(error instanceof Error ? error.message.split("\n")[0] ?? "" : String(error)));
  const frontUrls = tabs instanceof Error ? undefined : tabs.filter(tab => tab.active).map(tab => tab.url);
  const openTabs: OpenTab[] = tabs instanceof Error
    ? context.pages().filter(page => !page.isClosed()).map(page => ({ url: page.url(), inFront: "unknown" as const }))
    : tabs.map(tab => ({ url: tab.url, inFront: tab.active }));
  const inFront = (page: Page) => frontUrls?.includes(page.url()) === true;
  const web = [...context.pages()].reverse().filter(showsWebPage);
  const page = showsWebPage(own) && (frontUrls === undefined || inFront(own)) ? own : web.find(inFront) ?? (showsWebPage(own) ? own : web[0] ?? own);
  const frontTabs = frontUrls ?? [`unreadable: ${(tabs as Error).message}`];
  if (page.isClosed()) return { page, inFront: false, frontTabs, openTabs };
  const documentVisibility = await withTimeout(page.evaluate(() => document.visibilityState), 1_000, "the tab's visibility").catch((error: unknown) => `unreadable: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  return { page, documentVisibility, inFront: frontUrls === undefined ? "unknown" : inFront(page), frontTabs, openTabs };
}
