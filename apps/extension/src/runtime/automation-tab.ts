// The tab FluxIQ drives, and the waiting that keeps actions off a half-loaded
// page.
//
// The automation tab is remembered so a Flow's actions land on the page the
// previous action left behind: navigate reuses it by default, a tab switch
// re-points it, and closing it goes back to the tab driven before it. Before
// Phase 1.2 step 4 every navigation opened a new tab, so each step ran on a
// fresh blank page and left the last one behind.
//
// Driving the tab reports what it did (`TabDriveRecord`), because nothing can
// see it afterwards: the address reads the same whether the page was loaded
// again or nothing happened at all, which is how a navigate that never left
// the page it was already on was reported as a success. `navigation-outcome.ts`
// judges the record.

const DEFAULT_AUTOMATION_URL = "about:blank";

/** How many driven tabs are remembered. A Flow nests tabs far less deeply than this. */
const AUTOMATION_TAB_HISTORY = 8;

// The tabs FluxIQ has driven, oldest first. The last is the automation tab.
let automationTabs: number[] = [];

type SnapshotReadinessProof = {
  tabId: number;
  url: string;
  documentId: string;
  capturedAt: number;
};

/**
 * A successful DOM snapshot is stronger evidence than another tab poll: the
 * target document was complete enough for its content script to answer. The
 * proof is deliberately one-shot and names Chrome's document UUID. A worker
 * restart may preserve it in session storage, but any new document fails the
 * identity check and keeps the ordinary settling wait.
 */
let snapshotReadinessProof: SnapshotReadinessProof | undefined;
const SNAPSHOT_READINESS_MAX_AGE_MS = 10_000;
const SNAPSHOT_READINESS_STORAGE_KEY = "runtimeSnapshotReadinessProof";

/**
 * What driving a tab to a URL did to it: the address and document it was on,
 * the ones it ended on, and how the drive was issued.
 *
 * `documentBefore` and `documentAfter` are Chrome's top-frame document UUIDs,
 * which change whenever the document is replaced -- including by a reload,
 * which is the only work a navigation to the page a tab already shows
 * performs. Either may be absent when the browser would not say, and that is
 * not evidence of anything: the judgement treats it as unknown rather than as
 * a no-op.
 */
export type TabDriveRecord = {
  urlBefore?: string | undefined;
  urlAfter?: string | undefined;
  documentBefore?: string | undefined;
  documentAfter?: string | undefined;
  /** The tab was opened for this drive, so it holds a document it did not hold before, by construction. */
  opened: boolean;
  /** The drive was issued as a reload, because the tab already showed the URL. */
  reloaded: boolean;
};

/** The tab an action runs in, and what driving it to the requested URL did, when it was driven anywhere. */
export type AutomationTabResolution = {
  tabId: number;
  drive?: TabDriveRecord | undefined;
};

export async function resolveAutomationTab(input: { requestedTabId?: number; initialUrl?: string; active?: boolean; forceNew?: boolean } = {}): Promise<AutomationTabResolution> {
  const initialUrl = input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL ? input.initialUrl : undefined;
  if (input.requestedTabId !== undefined) {
    // A named tab is still driven to the requested URL; otherwise a navigation
    // addressed at a specific tab would resolve the tab and go nowhere.
    const drive = initialUrl ? await updateTabUrl(input.requestedTabId, initialUrl) : undefined;
    return { tabId: input.requestedTabId, drive };
  }
  const existing = input.forceNew === true ? undefined : await existingAutomationTab();
  if (existing !== undefined) {
    const drive = initialUrl ? await updateTabUrl(existing, initialUrl) : undefined;
    return { tabId: existing, drive };
  }
  const tab = await chrome.tabs.create({
    url: input.initialUrl ?? DEFAULT_AUTOMATION_URL,
    active: input.active ?? true
  });
  if (tab.id === undefined) throw new Error("Unable to create FluxIQ automation tab.");
  setAutomationTab(tab.id);
  if (!initialUrl) return { tabId: tab.id };
  await waitForTabReady(tab.id);
  // A tab opened at the URL is a move by construction: there was no document
  // before it, and the one it now holds is the navigation's own.
  return {
    tabId: tab.id,
    drive: { opened: true, reloaded: false, urlAfter: await readTabUrl(tab.id), documentAfter: await readTopDocumentId(tab.id) }
  };
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
  void clearSnapshotReadiness();
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
  return (await readTab(tabId))?.url;
}

/** The tab's current title: the cheapest evidence a worker-side result can carry about which page it is reporting. */
export async function readTabTitle(tabId: number): Promise<string | undefined> {
  return (await readTab(tabId))?.title;
}

/** Whether the tab still exists, which is how a close is confirmed. */
export async function tabIsOpen(tabId: number): Promise<boolean> {
  return await readTab(tabId) !== undefined;
}

/** The tab as the browser reports it, or undefined when it is gone or unreadable. */
async function readTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return undefined;
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
 * Drives the tab to the URL, reloads it when that is where it already is, and
 * reports what that did.
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
 *
 * The record returned is what says the reload happened. Nothing else can: the
 * address bar reads the same either way, and a `tabs.reload` the browser did
 * not act on -- a page holding its own unload, an extension context torn down
 * mid-command -- leaves the tab exactly as it was.
 */
async function updateTabUrl(tabId: number, url: string): Promise<TabDriveRecord> {
  await clearSnapshotReadiness();
  const urlBefore = await readTabUrl(tabId);
  const documentBefore = await readTopDocumentId(tabId);
  const reloaded = urlBefore === url;
  if (reloaded) {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url, active: true });
  }
  await waitForTabReady(tabId);
  return {
    urlBefore,
    documentBefore,
    urlAfter: await readTabUrl(tabId),
    documentAfter: await readTopDocumentId(tabId),
    opened: false,
    reloaded
  };
}

/** Remembers that a read-only snapshot just answered from this exact document. */
export async function noteSnapshotReadiness(tabId: number, url: string | undefined): Promise<void> {
  if (!url) return;
  const documentId = await readTopDocumentId(tabId);
  if (!documentId) return;
  snapshotReadinessProof = { tabId, url, documentId, capturedAt: Date.now() };
  try {
    await chrome.storage?.session?.set({ [SNAPSHOT_READINESS_STORAGE_KEY]: snapshotReadinessProof });
  } catch {
    /* best-effort: the in-memory proof remains safe for the immediate command */
  }
}

/**
 * Consumes the immediately preceding snapshot proof when Chrome still reports
 * the same complete document. A failed check falls back to waitForTabReady.
 */
export async function consumeSnapshotReadiness(tabId: number): Promise<boolean> {
  let stored: unknown;
  if (snapshotReadinessProof === undefined) {
    try {
      stored = (await chrome.storage?.session?.get(SNAPSHOT_READINESS_STORAGE_KEY))?.[SNAPSHOT_READINESS_STORAGE_KEY];
    } catch {
      stored = undefined;
    }
  }
  const proof = snapshotReadinessProof ?? (isSnapshotReadinessProof(stored) ? stored : undefined);
  await clearSnapshotReadiness();
  if (!proof || proof.tabId !== tabId || Date.now() - proof.capturedAt > SNAPSHOT_READINESS_MAX_AGE_MS) return false;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status !== "complete" || tab.url !== proof.url || isTransientNavigationUrl(tab.url)) return false;
    return await readTopDocumentId(tabId) === proof.documentId;
  } catch {
    return false;
  }
}

async function clearSnapshotReadiness(): Promise<void> {
  snapshotReadinessProof = undefined;
  if (typeof chrome === "undefined") return;
  try {
    await chrome.storage?.session?.remove(SNAPSHOT_READINESS_STORAGE_KEY);
  } catch {
    /* best-effort: a missing session store is only a conservative cache miss */
  }
}

function isSnapshotReadinessProof(value: unknown): value is SnapshotReadinessProof {
  const proof = value as Partial<SnapshotReadinessProof> | undefined;
  return typeof proof?.tabId === "number" && typeof proof.url === "string" &&
    typeof proof.documentId === "string" && typeof proof.capturedAt === "number";
}

function readTopDocumentId(tabId: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
      const error = chrome.runtime.lastError;
      if (error || !frames) resolve(undefined);
      else resolve(frames.find((frame) => frame.frameId === 0)?.documentId);
    });
  });
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
