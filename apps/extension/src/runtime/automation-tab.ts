// The tab FluxIQ drives, and the waiting that keeps actions off a half-loaded
// page.
//
// An action waits only when the page has begun to move (task speed S3): a look
// that answered from this document is its readiness proof, and the proof stands
// for as long as the browser reports no navigation of the tab's top frame
// (`./navigation-events/`), across the act it precedes, so the look after the
// act needs no wait either. Only an action after a navigation began waits for
// the tab to settle (`waitForTabReady`).
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
// the page it was already on was reported as a success. `navigation/outcome.ts`
// judges the record.

import { pageWorkSettled, refreshDeclaredSoon, tabNavigationEpochs } from "./navigation-events";

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
  /** The tab's navigation epoch when the look answered, and the worker that counted it (`./navigation-events/`). */
  epoch?: number;
  watcher?: string;
};

/**
 * A successful DOM snapshot is stronger evidence than another tab poll: the
 * target document was complete enough for its content script to answer. The
 * proof names Chrome's document UUID and the tab's navigation epoch. While this
 * worker has seen no navigation event of the tab since, the same complete
 * document at the same address is ready, however many actions have run on it:
 * an act that navigates moves the epoch, and the next action waits
 * (task speed S3). Until 2026-11-10 the proof was used once, by the act after a
 * look, and the look after the act then polled a full second of address
 * stability although nothing had navigated.
 *
 * A proof kept by a worker before a restart (session storage) was counted by
 * another worker, which may have missed the events in between: it is held to
 * the old rule, used once and within `SNAPSHOT_READINESS_MAX_AGE_MS`.
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
  /**
   * The tab already showed the URL and the page there was a robot check, so
   * it was not reloaded: a reload asks the check again and restarts a
   * countdown, and FluxIQ never reloads one. The navigation then waits the
   * check out or hands it to the person (`action-runner.ts`).
   */
  heldForCheck?: boolean;
};

/** The tab an action runs in, and what driving it to the requested URL did, when it was driven anywhere. */
export type AutomationTabResolution = {
  tabId: number;
  drive?: TabDriveRecord | undefined;
};

/** Where an action wants its tab, and, for a navigation, how to tell that the tab is showing a robot check. */
export type AutomationTabRequest = {
  requestedTabId?: number;
  initialUrl?: string;
  active?: boolean;
  forceNew?: boolean;
  /** Whether the tab's page is a robot check now. Asked only before reloading a tab that already shows the URL. */
  holdsRobotCheck?: (tabId: number) => Promise<boolean>;
};

export async function resolveAutomationTab(input: AutomationTabRequest = {}): Promise<AutomationTabResolution> {
  const initialUrl = input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL ? input.initialUrl : undefined;
  if (input.requestedTabId !== undefined) {
    // A named tab is still driven to the requested URL; otherwise a navigation
    // addressed at a specific tab would resolve the tab and go nowhere.
    const drive = initialUrl ? await updateTabUrl(input.requestedTabId, initialUrl, input.holdsRobotCheck) : undefined;
    return { tabId: input.requestedTabId, drive };
  }
  const existing = input.forceNew === true ? undefined : await existingAutomationTab();
  if (existing !== undefined) {
    const drive = initialUrl ? await updateTabUrl(existing, initialUrl, input.holdsRobotCheck) : undefined;
    return { tabId: existing, drive };
  }
  const tab = await chrome.tabs.create({
    url: input.initialUrl ?? DEFAULT_AUTOMATION_URL,
    active: input.active ?? true
  });
  if (tab.id === undefined) throw new Error("Unable to create FluxIQ automation tab.");
  setAutomationTab(tab.id);
  if (!initialUrl) return { tabId: tab.id };
  // A new tab has had no navigation of its own before this one.
  await waitForTabReady(tab.id, { epochBefore: 0 });
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
 *
 * One page is never reloaded: a robot check. A check is served at the address
 * that was asked for, so reloading it asks again, and a check that counts down
 * starts its countdown over; on 2026-09-29 repeated same-address reloads kept
 * the crossborder marketplace's check up for most of two builds. When the tab
 * already shows the URL and `holdsRobotCheck` says its page is a check, the tab
 * is only brought to the front, and the record says the drive was held
 * (`heldForCheck`).
 */
async function updateTabUrl(tabId: number, url: string, holdsRobotCheck?: (tabId: number) => Promise<boolean>): Promise<TabDriveRecord> {
  await clearSnapshotReadiness();
  const urlBefore = await readTabUrl(tabId);
  const documentBefore = await readTopDocumentId(tabId);
  const reloaded = urlBefore === url;
  // Read before the drive, so the wait knows the browser has begun this navigation and not an earlier one.
  const epochBefore = tabNavigationEpochs.of(tabId);
  if (reloaded && holdsRobotCheck !== undefined && await holdsRobotCheck(tabId)) {
    await chrome.tabs.update(tabId, { active: true });
    return { urlBefore, documentBefore, urlAfter: urlBefore, documentAfter: documentBefore, opened: false, reloaded: false, heldForCheck: true };
  }
  if (reloaded) {
    await chrome.tabs.update(tabId, { active: true });
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url, active: true });
  }
  await waitForTabReady(tabId, { epochBefore });
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
  snapshotReadinessProof = { tabId, url, documentId, capturedAt: Date.now(), epoch: tabNavigationEpochs.of(tabId), watcher: tabNavigationEpochs.instance };
  try {
    await chrome.storage?.session?.set({ [SNAPSHOT_READINESS_STORAGE_KEY]: snapshotReadinessProof });
  } catch {
    /* best-effort: the in-memory proof remains safe for the immediate command */
  }
}

/**
 * Whether the tab is ready from the last look's proof: the same complete
 * document at the same address, and no navigation event of the tab since. A
 * proof this worker counted stands for every action after it until the page
 * moves; one from a worker before a restart is used once. A failed check
 * forgets the proof and falls back to waitForTabReady.
 */
export async function readyFromSnapshot(tabId: number): Promise<boolean> {
  let stored: unknown;
  if (snapshotReadinessProof === undefined) {
    try {
      stored = (await chrome.storage?.session?.get(SNAPSHOT_READINESS_STORAGE_KEY))?.[SNAPSHOT_READINESS_STORAGE_KEY];
    } catch {
      stored = undefined;
    }
  }
  const proof = snapshotReadinessProof ?? (isSnapshotReadinessProof(stored) ? stored : undefined);
  const counted = proof?.watcher === tabNavigationEpochs.instance && proof.epoch !== undefined;
  // Another worker's proof is the old one-shot proof; this worker's stands until the page moves.
  if (!counted) await clearSnapshotReadiness();
  if (!proof || proof.tabId !== tabId) return false;
  if (counted ? tabNavigationEpochs.of(tabId) !== proof.epoch : Date.now() - proof.capturedAt > SNAPSHOT_READINESS_MAX_AGE_MS) return await notReady(counted);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status !== "complete" || tab.url !== proof.url || isTransientNavigationUrl(tab.url)) return await notReady(counted);
    return await readTopDocumentId(tabId) === proof.documentId || await notReady(counted);
  } catch {
    return await notReady(counted);
  }
}

/** A check that failed: this worker's proof no longer stands, and is forgotten. */
async function notReady(counted: boolean): Promise<false> {
  if (counted) await clearSnapshotReadiness();
  return false;
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

/**
 * Waits until the tab has finished moving and the page has finished drawing
 * itself, or 20 s have passed (task speed S10):
 * - by the browser's events: its load complete, no address pending, no
 *   top-frame navigation begun and not ended (`./navigation-events/epochs.ts`),
 *   and, for a tab FluxIQ drove (`drive`), the navigation heard beginning;
 * - by the page's own work: every timer it set within the horizon, animation
 *   frame, fetch and XHR it began done, recurring work left out, and its
 *   document unchanged across a task (`./navigation-events/page-work.ts`,
 *   `page-world/page-work/`). local-classifieds draws a listing's panel from a
 *   timer then a request, and its sorted results after an address rewritten in
 *   place and a delay; the load event alone said neither was there.
 *
 * Until 2026-11-10 it waited instead for the address to stand still a whole
 * second. That second is kept only where nothing can speak for the page: a
 * drive the browser ignored (it begins nothing), a page with no page world
 * counting, and a page that declares a refresh due within it
 * (`./navigation-events/declared-refresh.ts`).
 *
 * A tab found settled is proven ready as a look proves it
 * (`noteSnapshotReadiness`): while no navigation event of the tab follows, the
 * same document is the tab this wait just found settled, so the next action on
 * it starts at once. A wait that ends on its deadline, or on a tab that closed,
 * proves nothing.
 */
export function waitForTabReady(tabId: number, drive?: { epochBefore: number }): Promise<void> {
  return new Promise((resolve) => {
    let lastUrl: string | undefined;
    let stableSince = 0;
    let settling = false;
    const interval = setInterval(checkSettled, 250);
    const timeout = setTimeout(done, 20_000);
    function done(): void {
      clearTimeout(timeout);
      clearInterval(interval);
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.webNavigation?.onCompleted?.removeListener(ended);
      chrome.webNavigation?.onErrorOccurred?.removeListener(ended);
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
    // The top frame's navigation ending is an event this wait is for: asked again at once, not at the next poll.
    function ended(details: { tabId: number; frameId: number }): void {
      if (details.tabId === tabId && details.frameId === 0) void checkSettled();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.webNavigation?.onCompleted?.addListener(ended);
    chrome.webNavigation?.onErrorOccurred?.addListener(ended);
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
        if (tab.status !== "complete" || tab.pendingUrl) return;
        if (isTransientNavigationUrl(url)) return;
        if (settling) return;
        settling = true;
        if (!await settledOnEvidence(tabId, drive) && Date.now() - stableSince < 1_000) {
          settling = false;
          return;
        }
        await noteSnapshotReadiness(tabId, url);
        done();
      } catch {
        done();
      }
    }
  });
}

/**
 * Whether the tab's settling is told by evidence, waiting on the page's own
 * work when it is: false when the drive was not heard beginning, a navigation is
 * still in flight, the page declares a refresh due soon, or no page world can
 * speak for the page -- and the old second then decides.
 */
async function settledOnEvidence(tabId: number, drive: { epochBefore: number } | undefined): Promise<boolean> {
  if (drive !== undefined && tabNavigationEpochs.of(tabId) === drive.epochBefore) return false;
  if (tabNavigationEpochs.inFlight(tabId)) return false;
  if (await refreshDeclaredSoon(tabId)) return false;
  return await pageWorkSettled(tabId);
}

function isTransientNavigationUrl(url: string | undefined): boolean {
  return Boolean(url && /:\/\/accounts\.google\.com\/RotateCookiesPage\b/.test(url));
}
