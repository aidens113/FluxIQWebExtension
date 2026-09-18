// The tab FluxIQ drives, and the waiting that keeps actions off a half-loaded
// page.
//
// The automation tab is remembered so a Flow's actions land on the page the
// previous action left behind: navigate reuses it by default, a tab switch
// re-points it, and closing it goes back to the tab driven before it. Before
// Phase 1.2 step 4 every navigation opened a new tab, so each step ran on a
// fresh blank page and left the last one behind.

const DEFAULT_AUTOMATION_URL = "about:blank";

/** How many driven tabs are remembered. A Flow nests tabs far less deeply than this. */
const AUTOMATION_TAB_HISTORY = 8;

// The tabs FluxIQ has driven, oldest first. The last is the automation tab.
let automationTabs: number[] = [];

export async function resolveAutomationTab(input: { requestedTabId?: number; initialUrl?: string; active?: boolean; forceNew?: boolean } = {}): Promise<number> {
  if (input.requestedTabId !== undefined) {
    // A named tab is still driven to the requested URL; otherwise a navigation
    // addressed at a specific tab would resolve the tab and go nowhere.
    if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await updateTabUrl(input.requestedTabId, input.initialUrl);
    return input.requestedTabId;
  }
  const existing = input.forceNew === true ? undefined : await existingAutomationTab();
  if (existing !== undefined) {
    if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await updateTabUrl(existing, input.initialUrl);
    return existing;
  }
  const tab = await chrome.tabs.create({
    url: input.initialUrl ?? DEFAULT_AUTOMATION_URL,
    active: input.active ?? true
  });
  if (tab.id === undefined) throw new Error("Unable to create FluxIQ automation tab.");
  setAutomationTab(tab.id);
  if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await waitForTabReady(tab.id);
  return tab.id;
}

/** Points FluxIQ at this tab, so the actions that follow run where this one left off; the tab before it is remembered. */
export function setAutomationTab(tabId: number): void {
  automationTabs = [...automationTabs.filter((id) => id !== tabId), tabId].slice(-AUTOMATION_TAB_HISTORY);
}

/**
 * Forgets a tab, or every tab when none is named. Forgetting the automation tab
 * makes the tab driven before it the automation tab again.
 */
export function forgetAutomationTab(tabId?: number): void {
  automationTabs = tabId === undefined ? [] : automationTabs.filter((id) => id !== tabId);
}

export function currentAutomationTabId(): number | undefined {
  return automationTabs.at(-1);
}

/** The most recently driven tab that is still open. Tabs that have closed are forgotten on the way. */
export async function latestOpenAutomationTab(): Promise<number | undefined> {
  for (let tabId = currentAutomationTabId(); tabId !== undefined; tabId = currentAutomationTabId()) {
    if (await tabIsOpen(tabId)) return tabId;
    forgetAutomationTab(tabId);
  }
  return undefined;
}

/** The tab's current URL, or undefined when it is gone or unreadable. */
export async function readTabUrl(tabId: number): Promise<string | undefined> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url;
  } catch {
    return undefined;
  }
}

/** Whether the tab still exists, which is how a close is confirmed. */
export async function tabIsOpen(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

async function existingAutomationTab(): Promise<number | undefined> {
  const automationTabId = currentAutomationTabId();
  if (automationTabId === undefined) return undefined;
  try {
    const tab = await chrome.tabs.get(automationTabId);
    return tab.id;
  } catch {
    forgetAutomationTab(automationTabId);
    return undefined;
  }
}

/**
 * Drives the tab to the URL, and reloads it when that is where it already is.
 *
 * Chrome ignores a `tabs.update` to the address the tab already shows, so a
 * navigation to the current page did nothing at all: the Flow inherited
 * whatever the last thing to touch that tab had left on it. That is how a
 * dialog opened while the Flow was being authored was still up when the Flow
 * ran and blocked its first step -- the tab was never reloaded between the
 * two, because the Flow's opening navigate named the page the tab was on.
 *
 * A navigation means "be on this page", not "be on this page unless you
 * already are", so the same address is a reload rather than a no-op. Anything
 * a previous step put on the page goes with it, which is what a Flow author
 * writing a navigation asks for.
 */
async function updateTabUrl(tabId: number, url: string): Promise<void> {
  if (await readTabUrl(tabId) === url) {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url, active: true });
  }
  await waitForTabReady(tabId);
}

export function waitForTabReady(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    let lastUrl: string | undefined;
    let stableSince = 0;
    const interval = setInterval(checkSettled, 250);
    const timeout = setTimeout(done, 20_000);
    function done(): void {
      clearTimeout(timeout);
      clearInterval(interval);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
      if (updatedTabId !== tabId) return;
      if (changeInfo.url) {
        lastUrl = undefined;
        stableSince = 0;
      }
      if (changeInfo.status === "complete") void checkSettled();
    }
    chrome.tabs.onUpdated.addListener(listener);
    void checkSettled();

    async function checkSettled(): Promise<void> {
      try {
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url;
        const now = Date.now();
        if (url !== lastUrl) {
          lastUrl = url;
          stableSince = now;
        }
        if (tab.status !== "complete") return;
        if (isTransientNavigationUrl(url)) return;
        if (now - stableSince >= 1_000) done();
      } catch {
        done();
      }
    }
  });
}

function isTransientNavigationUrl(url: string | undefined): boolean {
  return Boolean(url && /:\/\/accounts\.google\.com\/RotateCookiesPage\b/.test(url));
}
