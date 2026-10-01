// T1 coverage of click-landing.ts for a click that opened its page in a tab of
// its own: crossborder's search result cards are `target="_blank"` links, and
// such a click committed nothing in its own tab, came back a success, and left
// every later step on the results page while the item sat in a tab nothing
// drove (lane A, `t174-w32`). Now the opened tab is driven from then on and its
// landing is judged as an own-tab landing is.
//
// The browser is stubbed at what the worker reads: `webNavigation`'s events
// (the opened tab announced by `onCreatedNavigationTarget`), `tabs.get` and
// `tabs.onUpdated` (the opened tab's readiness), `tabs.remove`, and the
// scripting injection that reads a document's served status. What this cannot
// prove is how a real Chromium orders those events, or whether a person's
// popup blocker lets the tab open at all.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { OriginPace, PAGE_LOAD_PACE_SETTINGS } from "../../background/page-pace";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { currentAutomationTabId, forgetAutomationTab, setAutomationTab } from "../automation-tab";
import { sendClickCheckingLanding } from "../click-landing";
import type { LandedTabAccess } from "../landed-check-wait";

const CLICKED_TAB = 41;
const OPENED_TAB = 77;
const ORIGIN = "http://127.0.0.1:64130";
const RESULTS = `${ORIGIN}/scenarios/crossborder-marketplace/search?q=usb+c+hub`;
const ITEM = `${ORIGIN}/scenarios/crossborder-marketplace/item/1005008123450?src=search`;
const ITEM_PATH = "/scenarios/crossborder-marketplace/item/1005008123450";

const CLICK: BrowserActionCommand = { commandId: "c-card", actionType: "web.dom.click", selector: "a.card-title", tabId: CLICKED_TAB };

const REPLY: BrowserActionResult = {
  commandId: "c-card",
  actionType: "web.dom.click",
  status: "succeeded",
  message: "Element clicked.",
  validation: { status: "passed", expected: "navigation to the item begins", actual: `navigation to ${ITEM} was initiated` },
  url: RESULTS,
  startedAt: 100,
  finishedAt: 120
};

const NO_CHECK: LandedTabAccess = {
  send: <T>() => Promise.resolve({ challenge: null } as T),
  settle: () => Promise.resolve()
};

const PERSON_ONLY_CHECK: LandedTabAccess = {
  send: <T>() => Promise.resolve({ challenge: "captcha", robotCheck: "person_only" } as T),
  settle: () => Promise.resolve()
};

type Listener = (details: Record<string, unknown>) => void;
type EventName = "onBeforeNavigate" | "onCommitted" | "onErrorOccurred" | "onCreatedNavigationTarget";

type Browser = {
  /** The page announcing a tab opened from `sourceTabId`. */
  open(sourceTabId: number): void;
  removed: number[];
  listening(): number;
};

/** A browser whose tabs show `urls`, served with `statuses` by tab, and whose opened tab is ready at once. */
function installBrowser(t: TestContext, statuses: Record<number, number | undefined> = {}): Browser {
  const listeners: Record<EventName, Set<Listener>> = {
    onBeforeNavigate: new Set(),
    onCommitted: new Set(),
    onErrorOccurred: new Set(),
    onCreatedNavigationTarget: new Set()
  };
  const urls: Record<number, string> = { [CLICKED_TAB]: RESULTS, [OPENED_TAB]: ITEM };
  let served: number | undefined;
  const entries = (type: string) => (type === "navigation" && served !== undefined ? [{ responseStatus: served }] : []);
  t.mock.method(performance, "getEntriesByType", entries as unknown as typeof performance.getEntriesByType);
  const event = (name: EventName) => ({
    addListener: (listener: Listener) => void listeners[name].add(listener),
    removeListener: (listener: Listener) => void listeners[name].delete(listener)
  });
  const browser: Browser = {
    open(sourceTabId) {
      for (const listener of [...listeners.onCreatedNavigationTarget]) listener({ sourceTabId, sourceFrameId: 0, tabId: OPENED_TAB, url: ITEM });
    },
    removed: [],
    listening: () => Object.values(listeners).reduce((sum, set) => sum + set.size, 0)
  };
  (globalThis as { chrome?: unknown }).chrome = {
    webNavigation: {
      onBeforeNavigate: event("onBeforeNavigate"),
      onCommitted: event("onCommitted"),
      onErrorOccurred: event("onErrorOccurred"),
      onCreatedNavigationTarget: event("onCreatedNavigationTarget")
    },
    tabs: {
      get: (tabId: number) => (urls[tabId] ? Promise.resolve({ id: tabId, url: urls[tabId], status: "complete", title: `tab ${tabId}` }) : Promise.reject(new Error(`No tab with id: ${tabId}.`))),
      remove: (tabId: number) => {
        browser.removed.push(tabId);
        delete urls[tabId];
        return Promise.resolve();
      },
      onUpdated: { addListener: () => undefined, removeListener: () => undefined }
    },
    scripting: {
      executeScript: (details: { target: { tabId: number }; func: () => unknown }) => {
        served = statuses[details.target.tabId];
        try {
          return Promise.resolve([{ frameId: 0, result: details.func() }]);
        } finally {
          served = undefined;
        }
      }
    }
  };
  t.after(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
    forgetAutomationTab();
  });
  forgetAutomationTab();
  setAutomationTab(CLICKED_TAB);
  return browser;
}

/** The card pressed in the clicked tab; the page opens its item in a tab of its own from `sourceTabId`, or none. */
function pressCard(browser: Browser, opensFrom: number | undefined, access: LandedTabAccess = NO_CHECK, pace?: OriginPace): Promise<BrowserActionResult> {
  return sendClickCheckingLanding(CLICK, CLICKED_TAB, () => {
    if (opensFrom !== undefined) browser.open(opensFrom);
    return Promise.resolve(REPLY);
  }, access, pace);
}

const actualOf = (result: BrowserActionResult): string => (result.validation.status === "none" ? "" : result.validation.actual);

test("a click whose page opened in a new tab drives that tab from then on, and says so", async (t) => {
  const browser = installBrowser(t, { [OPENED_TAB]: 200 });
  const result = await pressCard(browser, CLICKED_TAB);
  assert.equal(result.status, "succeeded");
  assert.equal(currentAutomationTabId(), OPENED_TAB, "the next step drives the item, not the results page");
  assert.equal(actualOf(result), `navigation to ${ITEM} was initiated; its page opened in a new tab (${ITEM_PATH}), which the run now drives`);
  assert.equal(result.url, ITEM, "the result names the page the run is now on");
  assert.match(result.message ?? "", /opened in a new tab/u);
  assert.equal(browser.listening(), 0, "every listener is removed");
});

test("a click that opened no tab is returned as it was, within its own grace, and the tab driven is unchanged", async (t) => {
  const browser = installBrowser(t);
  const began = Date.now();
  const result = await pressCard(browser, undefined);
  assert.deepEqual(result, REPLY);
  assert.ok(Date.now() - began < 1_000, "no wait beyond the own-tab grace");
  assert.equal(currentAutomationTabId(), CLICKED_TAB);
  assert.equal(browser.listening(), 0);
});

test("a tab opened from another tab is not this click's", async (t) => {
  const browser = installBrowser(t, { [OPENED_TAB]: 200 });
  const result = await pressCard(browser, 99);
  assert.deepEqual(result, REPLY);
  assert.equal(currentAutomationTabId(), CLICKED_TAB);
});

test("a new tab served 429 is closed, the clicked tab driven again, the pace told, and the click rate limited", async (t) => {
  const browser = installBrowser(t, { [OPENED_TAB]: 429 });
  const pace = new OriginPace(PAGE_LOAD_PACE_SETTINGS, () => 1_000_000);
  const result = await pressCard(browser, CLICKED_TAB, NO_CHECK, pace);
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(result.failure?.retryAfterMs, PAGE_LOAD_PACE_SETTINGS.refusalWaitMs);
  assert.equal(pace.refusalsOf(ORIGIN), 1);
  assert.deepEqual(browser.removed, [OPENED_TAB]);
  assert.equal(currentAutomationTabId(), CLICKED_TAB, "a repeat presses the same card in the tab it was pressed in");
  assert.match(actualOf(result), /the tab was taken back to the page the click was pressed on/u);
});

test("a new tab served 404 is a refused landing, and the tab stays driven", async (t) => {
  const browser = installBrowser(t, { [OPENED_TAB]: 404 });
  const result = await pressCard(browser, CLICKED_TAB);
  assert.equal(result.failure?.code, "web.navigation.unexpected");
  assert.match(actualOf(result), new RegExp(`HTTP 404 for ${ITEM_PATH}`, "u"));
  assert.deepEqual(browser.removed, []);
  assert.equal(currentAutomationTabId(), OPENED_TAB);
});

test("a robot check in the new tab is the person's to answer", async (t) => {
  const browser = installBrowser(t, { [OPENED_TAB]: 200 });
  const result = await pressCard(browser, CLICKED_TAB, PERSON_ONLY_CHECK);
  assert.equal(result.failure?.code, "web.intervention.required");
  assert.equal(currentAutomationTabId(), OPENED_TAB, "the person answers the check where it stands");
});
