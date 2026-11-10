// Whether a tab's page has begun to move since a moment, told by the browser's
// own navigation events rather than by watching its address stay still.
//
// Each tab has an epoch, a count of the navigation events the browser has
// reported for its top frame: a navigation beginning or committing, the
// address moving within the document (`history.pushState`, a fragment), or the
// tab being replaced by a prerendered one. `tabs.onUpdated` is not listened
// to: its `loading` also reports a child frame loading, which is no move of the
// page a look is of, and every change of address it reports is one of the
// events above. A reader keeps the epoch it saw and later asks whether it is
// still the same: if it is, nothing has navigated the tab since, and a look
// taken then is a look at the document still there (task speed S3). Until
// 2026-11-10 every action paid a poll until the tab's address had stood still
// for a whole second, because the one proof of readiness there was could be
// used once (`../automation-tab.ts`).
//
// The listeners are added the first time an epoch is read, never on import,
// because a module that touches `chrome` while loading cannot be unit-tested in
// Node. That is enough for every reader: an epoch read before any event it must
// see was registered for that event. A worker that restarts starts again from
// nothing with a new `instance`, so an epoch kept by the worker before it --
// in session storage -- is never compared with one counted by this worker.

/** Child frames navigate on their own; only the top frame's navigation moves the page a look is of. */
const TOP_FRAME_ID = 0;

const epochs = new Map<number, number>();
/**
 * The tabs whose top frame has a navigation begun and not yet ended: set at
 * `onBeforeNavigate`, cleared at `onCompleted` (its document loaded) or
 * `onErrorOccurred` (it ended without one -- a download, a 204, an abort).
 * What `../automation-tab.ts` `waitForTabReady` reads to know a page has
 * finished moving, by the browser's own events (task speed S10).
 */
const inFlight = new Set<number>();
let installed = false;

/** This worker's count of navigation events: an epoch of another instance's means nothing here. */
const instance = `${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`;

function bump(tabId: number): void {
  epochs.set(tabId, (epochs.get(tabId) ?? 0) + 1);
}

function onTopFrame(details: { tabId: number; frameId: number }): void {
  if (details.frameId === TOP_FRAME_ID) bump(details.tabId);
}

function install(): void {
  if (installed) return;
  installed = true;
  const browser = (globalThis as { chrome?: typeof chrome }).chrome;
  const navigation = browser?.webNavigation;
  navigation?.onBeforeNavigate?.addListener((details) => {
    if (details.frameId !== TOP_FRAME_ID) return;
    bump(details.tabId);
    inFlight.add(details.tabId);
  });
  const ended = (details: { tabId: number; frameId: number }): void => {
    if (details.frameId === TOP_FRAME_ID) inFlight.delete(details.tabId);
  };
  navigation?.onCompleted?.addListener(ended);
  navigation?.onErrorOccurred?.addListener(ended);
  navigation?.onCommitted?.addListener(onTopFrame);
  navigation?.onHistoryStateUpdated?.addListener(onTopFrame);
  navigation?.onReferenceFragmentUpdated?.addListener(onTopFrame);
  browser?.tabs?.onReplaced?.addListener((added, removed) => {
    bump(added);
    bump(removed);
  });
  browser?.tabs?.onRemoved?.addListener((tabId) => {
    // A closed tab's id is never given to another tab, so its count is never read again.
    epochs.delete(tabId);
    inFlight.delete(tabId);
  });
}

/** A tab's navigation epoch, and this worker's instance it was counted by. */
export const tabNavigationEpochs = {
  instance,
  /** How many top-frame navigation events this worker has seen for the tab. Adds the listeners on first use. */
  of(tabId: number): number {
    install();
    return epochs.get(tabId) ?? 0;
  },
  /** Whether a top-frame navigation of the tab has begun and not yet ended, as this worker has heard. Adds the listeners on first use. */
  inFlight(tabId: number): boolean {
    install();
    return inFlight.has(tabId);
  },
  /** For a unit test: forget every count and listen again on the next read, against the `chrome` then present. */
  resetForTest(): void {
    epochs.clear();
    inFlight.clear();
    installed = false;
  }
};
