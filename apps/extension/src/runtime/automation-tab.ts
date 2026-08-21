const DEFAULT_AUTOMATION_URL = "about:blank";

let automationTabId: number | undefined;

export async function resolveAutomationTab(input: { requestedTabId?: number; initialUrl?: string; active?: boolean; forceNew?: boolean } = {}): Promise<number> {
  if (input.requestedTabId !== undefined) return input.requestedTabId;
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
