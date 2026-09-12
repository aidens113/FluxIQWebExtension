// The tab FluxIQ drives, and the waiting that keeps actions off a half-loaded
// page.
//
// The automation tab is remembered so a Flow's actions land on the page the
// previous action left behind: navigate reuses it by default, a tab switch
// re-points it, and closing it forgets it. Before Phase 1.2 step 4 every
// navigation opened a new tab, so each step ran on a fresh blank page and left
// the last one behind.

const DEFAULT_AUTOMATION_URL = "about:blank";

let automationTabId: number | undefined;

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
  automationTabId = tab.id;
  if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await waitForTabReady(tab.id);
  return tab.id;
}

/** Points FluxIQ at this tab, so the actions that follow run where this one left off. */
export function setAutomationTab(tabId: number): void {
  automationTabId = tabId;
}

/** Forgets the automation tab, by id when closing a specific one. */
export function forgetAutomationTab(tabId?: number): void {
  if (tabId === undefined || automationTabId === tabId) automationTabId = undefined;
}

export function currentAutomationTabId(): number | undefined {
  return automationTabId;
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
  if (automationTabId === undefined) return undefined;
  try {
    const tab = await chrome.tabs.get(automationTabId);
    return tab.id;
  } catch {
    automationTabId = undefined;
    return undefined;
  }
}

async function updateTabUrl(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url, active: true });
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
