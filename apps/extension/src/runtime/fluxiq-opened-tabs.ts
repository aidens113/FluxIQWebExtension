// The tabs FluxIQ itself opened, so a dry run's reset can close them and never
// a tab of the person's.
//
// A click on a `target="_blank"` link opens its page in a tab of its own, and
// the run drives that tab from then on (`click-landing.ts`). A build's test
// resets the page with a navigation, which drives whichever tab is in front,
// so each test pressed the link again from the last test's item tab and left
// one more tab open: the live run `run-musp8nz1-dbd3905a` ended with the home
// tab and three item tabs, one each from exploration, the build test and
// playback (t174-w93, cause 15).
//
// The reset now asks for these tabs to be closed (`closesOpenedTabs`,
// `command-options.ts`), and the runner closes exactly the tabs recorded here,
// then drives the tab the oldest of them was opened from (`action-runner.ts`).
// Only a tab FluxIQ opened is ever recorded -- one a click opened, one a Flow's
// tab-open or new-tab navigate created -- so a person's own tab, including the
// one the first click was pressed in, can never be in the record. The plain
// automation tab the runner creates when nothing else can be driven is not
// recorded either: it is the reset's own target, and closing it would only make
// the reset create it again.
//
// The record lives in the worker's memory, as the automation tab history does
// (`automation-tab.ts`): a service worker restart forgets it, and the tabs it
// held are then left open, which is what happened before it existed.

import { forgetAutomationTab, setAutomationTab, tabIsOpen } from "./automation-tab";

/** What closing the recorded tabs did: the tabs closed, and the tab to drive instead, when one is still open. */
export type FluxiqOpenedTabsClosed = { closed: number[]; returnTo?: number };

/** Each tab FluxIQ opened, by id, with the tab it was opened from when there was one; oldest first. */
const opened = new Map<number, number | undefined>();

export const fluxiqOpenedTabs = {
  /** Records a tab FluxIQ opened, and the tab it was opened from. */
  note(tabId: number, sourceTabId?: number): void {
    opened.delete(tabId);
    opened.set(tabId, sourceTabId);
  },

  /** Drops a tab from the record: it was closed by other means. */
  forget(tabId: number): void {
    opened.delete(tabId);
  },

  /** The recorded tabs, oldest first, for a test to read. */
  recorded(): Array<{ tabId: number; sourceTabId: number | undefined }> {
    return [...opened].map(([tabId, sourceTabId]) => ({ tabId, sourceTabId }));
  },

  /**
   * Closes every recorded tab and forgets it, here and as an automation tab. A
   * tab already gone is passed over. `returnTo` is the tab the oldest closed
   * tab was opened from, when that tab is still open and was not itself closed:
   * the page the person's run started from, which the reset then drives, and
   * which becomes the automation tab.
   */
  async closeAll(): Promise<FluxiqOpenedTabsClosed> {
    const records = [...opened];
    opened.clear();
    const closed: number[] = [];
    for (const [tabId] of records) {
      forgetAutomationTab(tabId);
      try {
        await chrome.tabs.remove(tabId);
        closed.push(tabId);
      } catch {
        /* best-effort: a tab the person or the page already closed has nothing left to close */
      }
    }
    const recordedIds = new Set(records.map(([tabId]) => tabId));
    for (const [, sourceTabId] of records) {
      if (sourceTabId === undefined || recordedIds.has(sourceTabId) || !await tabIsOpen(sourceTabId)) continue;
      setAutomationTab(sourceTabId);
      return { closed, returnTo: sourceTabId };
    }
    return { closed };
  }
};
