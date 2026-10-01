// T1 coverage of click-landing.ts for a click whose own tab lands on a page the
// site refused for coming too fast (429) or while it cannot serve (503): it
// fails `web.action.rate_limited`, retryable after the wait the origin's page
// pace now imposes, the pace hears of the refusal, and the tab is taken back
// to the page the click was pressed on, so Core's repeat of the same command
// finds the same control. The everything store's 429 page holds only a link to
// the address it refused, which no repeat could press.
//
// The browser is stubbed as in `click-landing.test.ts`, plus `tabs.get` (the
// address before the click) and `tabs.goBack`, whose stub commits the page it
// goes back to. What this cannot prove is that Chromium restores that page
// from the back/forward cache and fires the commit for it.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { OriginPace, PAGE_LOAD_PACE_SETTINGS } from "../../background/page-pace";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { sendClickCheckingLanding } from "../click-landing";
import type { LandedTabAccess } from "../landed-check-wait";

const TAB_ID = 41;
const STORE_ORIGIN = "http://127.0.0.1:64130";
/** The results page the click was pressed on; its query is a person's search and is never quoted. */
const PRESSED = `${STORE_ORIGIN}/scenarios/everything-store/s?k=wireless+earbuds&page=2`;
/** Where the pager's "Next" leads; the store answers it with its 429 page at that very address. */
const NEXT = `${STORE_ORIGIN}/scenarios/everything-store/s?k=wireless+earbuds&page=3#results`;
const LIMITED_PATH = "/scenarios/everything-store/s";
const CHANNEL_CLOSED_ERROR =
  "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received";

const CLICK: BrowserActionCommand = { commandId: "c-next", actionType: "web.dom.click", selector: "a.next", tabId: TAB_ID };

const REPLY: BrowserActionResult = {
  commandId: "c-next",
  actionType: "web.dom.click",
  status: "succeeded",
  message: "Element clicked.",
  validation: { status: "passed", expected: "the click lands on the target", actual: "it did" },
  url: PRESSED,
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

type NavigationEventName = "onBeforeNavigate" | "onCommitted" | "onErrorOccurred";
type Listener = (details: Record<string, unknown>) => void;

type Browser = {
  /** A navigation that starts and commits at once in tab 41's top frame. */
  land(url: string, documentId: string): void;
  listening(): number;
  /** Every injection's target, in order. */
  injections: Array<Record<string, unknown>>;
  /** How many times the tab was sent back. */
  wentBack: number;
};

type BrowserSetup = {
  /** What each document was served with, keyed by `documentId`. */
  statuses: Record<string, number | undefined>;
  /** What `tabs.get` says the tab shows before the click; an `Error` is a tab that cannot be read. */
  pressedUrl?: string | Error;
  /** What going back does: by default it commits PRESSED as `doc-pressed`; an `Error` is the browser refusing to go back. */
  goBack?: ((browser: Browser) => void) | Error;
};

function installBrowser(t: TestContext, setup: BrowserSetup): Browser {
  const listeners: Record<NavigationEventName, Set<Listener>> = {
    onBeforeNavigate: new Set(),
    onCommitted: new Set(),
    onErrorOccurred: new Set()
  };
  let served: number | undefined;
  const entries = (type: string) => (type === "navigation" && served !== undefined ? [{ responseStatus: served }] : []);
  t.mock.method(performance, "getEntriesByType", entries as unknown as typeof performance.getEntriesByType);
  const event = (name: NavigationEventName) => ({
    addListener: (listener: Listener) => void listeners[name].add(listener),
    removeListener: (listener: Listener) => void listeners[name].delete(listener)
  });
  const fire = (name: NavigationEventName, details: Record<string, unknown>): void => {
    for (const listener of [...listeners[name]]) listener({ tabId: TAB_ID, frameId: 0, ...details });
  };
  const browser: Browser = {
    land(url, documentId) {
      fire("onBeforeNavigate", { url });
      fire("onCommitted", { url, documentId });
    },
    listening: () => listeners.onBeforeNavigate.size + listeners.onCommitted.size + listeners.onErrorOccurred.size,
    injections: [],
    wentBack: 0
  };
  const pressedUrl = setup.pressedUrl ?? PRESSED;
  (globalThis as { chrome?: unknown }).chrome = {
    webNavigation: { onBeforeNavigate: event("onBeforeNavigate"), onCommitted: event("onCommitted"), onErrorOccurred: event("onErrorOccurred") },
    tabs: {
      get: (tabId: number) => (pressedUrl instanceof Error ? Promise.reject(pressedUrl) : Promise.resolve({ id: tabId, url: pressedUrl })),
      goBack: (tabId: number) => {
        assert.equal(tabId, TAB_ID);
        browser.wentBack += 1;
        if (setup.goBack instanceof Error) return Promise.reject(setup.goBack);
        if (setup.goBack) setup.goBack(browser);
        else browser.land(PRESSED, "doc-pressed");
        return Promise.resolve();
      }
    },
    scripting: {
      executeScript: (details: { target: Record<string, unknown> & { documentIds?: string[] }; func: () => unknown }) => {
        browser.injections.push(details.target);
        served = setup.statuses[details.target.documentIds?.[0] ?? "top"];
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
  });
  return browser;
}

/** A pace on a clock that does not move, so the wait it imposes is exact. */
function stillPace(refusalWaitMs = PAGE_LOAD_PACE_SETTINGS.refusalWaitMs): OriginPace {
  return new OriginPace({ ...PAGE_LOAD_PACE_SETTINGS, refusalWaitMs }, () => 1_000_000);
}

/** The click, pressed on PRESSED, whose navigation lands on NEXT served as `doc-limited`. */
function clickOntoLimitedPage(browser: Browser, pace: OriginPace | undefined, access: LandedTabAccess = NO_CHECK): Promise<BrowserActionResult> {
  return sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    browser.land(NEXT, "doc-limited");
    return REPLY;
  }, access, pace);
}

const actualOf = (result: BrowserActionResult): string => result.failure?.actual ?? "";

test("a click that lands on a page served 429 fails as rate_limited after the pace's wait, the pace hears of it, and the tab is taken back to where it was pressed", async (t) => {
  // A refusal wait unlike the default, so the wait on the record is shown to be the pace's own.
  const pace = stillPace(20_000);
  const browser = installBrowser(t, { statuses: { "doc-limited": 429, "doc-pressed": 200 } });
  const result = await clickOntoLimitedPage(browser, pace);

  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.effect, "unacted", "the record states the click's load did not happen");
  assert.equal(result.failure?.retryAfterMs, 20_000);
  assert.equal(pace.refusalsOf(STORE_ORIGIN), 1, "the origin's pace noted the refusal");
  assert.equal(browser.wentBack, 1);
  assert.equal(
    actualOf(result),
    `the server answered HTTP 429 for ${LIMITED_PATH}: the site refused the load for now and nothing was loaded; ` +
      `the tab was taken back to the page the click was pressed on (${LIMITED_PATH}); the same click may be made again after 20000 ms`
  );
  assert.deepEqual(result.validation, { status: "failed", expected: "the page the click leads to loads", actual: actualOf(result) });
  assert.equal(
    result.message,
    `The click was refused by the site for now: HTTP 429 for ${LIMITED_PATH}; the tab was taken back to the page it was pressed on, and the click may be made again after 20000 ms.`
  );
  assert.doesNotMatch(`${actualOf(result)} ${result.message}`, /wireless|earbuds|page=|#results/u, "no query or fragment is quoted");
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "Core's parser accepts the record");
  // What the frame said about the click itself is kept; only the verdict changes.
  assert.equal(result.commandId, REPLY.commandId);
  assert.equal(result.url, REPLY.url);
  // The refused landing's status, then the page it went back to.
  assert.deepEqual(browser.injections, [
    { tabId: TAB_ID, documentIds: ["doc-limited"] },
    { tabId: TAB_ID, documentIds: ["doc-pressed"] }
  ]);
  assert.equal(browser.listening(), 0, "every listener is gone with the call");
});

test("a click that lands on a page served 503 is rate_limited too, after the pace's wait, and with no pace after the refusal wait", async (t) => {
  const pace = stillPace();
  const paced = await clickOntoLimitedPage(installBrowser(t, { statuses: { "doc-limited": 503, "doc-pressed": 200 } }), pace);
  assert.equal(paced.failure?.code, "web.action.rate_limited");
  assert.equal(paced.failure?.retryAfterMs, PAGE_LOAD_PACE_SETTINGS.refusalWaitMs);
  assert.match(actualOf(paced), /^the server answered HTTP 503 for /u);
  assert.equal(pace.refusalsOf(STORE_ORIGIN), 1);

  const browser = installBrowser(t, { statuses: { "doc-limited": 503, "doc-pressed": 200 } });
  const unpaced = await clickOntoLimitedPage(browser, undefined);
  assert.equal(unpaced.failure?.code, "web.action.rate_limited");
  assert.equal(unpaced.failure?.retryable, true);
  assert.equal(unpaced.failure?.retryAfterMs, 8_500, "pagination.ts FIRST_RETRY_WAIT_MS");
  assert.match(actualOf(unpaced), /the same click may be made again after 8500 ms$/u);
  assert.equal(browser.wentBack, 1);
  assert.ok(parseAutomationStudioFailureRecord(unpaced.failure));
});

test("a click whose reply is lost to the unload onto a page served 429 is judged the same way", async (t) => {
  const pace = stillPace();
  const browser = installBrowser(t, { statuses: { "doc-limited": 429, "doc-pressed": 200 } });
  const result = await sendClickCheckingLanding(CLICK, TAB_ID, async () => {
    browser.land(NEXT, "doc-limited");
    throw new Error(CHANNEL_CLOSED_ERROR);
  }, NO_CHECK, pace);
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(result.failure?.retryAfterMs, PAGE_LOAD_PACE_SETTINGS.refusalWaitMs);
  assert.match(actualOf(result), /the tab was taken back to the page the click was pressed on/u);
  assert.equal(pace.refusalsOf(STORE_ORIGIN), 1);
  assert.equal(browser.wentBack, 1);
  assert.ok(parseAutomationStudioFailureRecord(result.failure));
});

test("a browser that will not go back is said, and the click is still rate_limited", async (t) => {
  const pace = stillPace();
  const browser = installBrowser(t, { statuses: { "doc-limited": 429 }, goBack: new Error("Cannot find a next page in history.") });
  const result = await clickOntoLimitedPage(browser, pace);
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(result.failure?.retryAfterMs, PAGE_LOAD_PACE_SETTINGS.refusalWaitMs);
  assert.match(
    actualOf(result),
    /; the tab was not taken back to the page the click was pressed on: the browser would not go back \(Cannot find a next page in history\.\), so it still shows the refused page; the same click may be made again after 8500 ms$/u
  );
  assert.match(result.message ?? "", /; the tab could not be taken back to the page it was pressed on, so it still shows the refused page; the click may be made again after 8500 ms\.$/u);
  assert.equal(browser.listening(), 0);
});

test("going back that commits no page is said", async (t) => {
  const browser = installBrowser(t, { statuses: { "doc-limited": 429 }, goBack: () => undefined });
  const result = await clickOntoLimitedPage(browser, stillPace());
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.match(actualOf(result), /; the tab was not taken back to the page the click was pressed on: going back committed no page, so it still shows the refused page; /u);
});

test("going back that lands somewhere other than where the click was pressed is said, naming both paths", async (t) => {
  const browser = installBrowser(t, {
    statuses: { "doc-limited": 429, "doc-home": 200 },
    goBack: (tab) => tab.land(`${STORE_ORIGIN}/scenarios/everything-store/?ref=nav`, "doc-home")
  });
  const result = await clickOntoLimitedPage(browser, stillPace());
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.match(
    actualOf(result),
    /; the tab was not taken back to the page the click was pressed on: going back landed on \/scenarios\/everything-store\/, not on \/scenarios\/everything-store\/s; /u
  );
  assert.doesNotMatch(actualOf(result), /ref=nav/u);
});

test("going back onto a page the server refused again is said", async (t) => {
  const browser = installBrowser(t, { statuses: { "doc-limited": 429, "doc-pressed": 429 } });
  const result = await clickOntoLimitedPage(browser, stillPace());
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.match(
    actualOf(result),
    /; the tab was not taken back to the page the click was pressed on: the page it went back to \(\/scenarios\/everything-store\/s\) was served HTTP 429; /u
  );
});

test("a tab whose address before the click went unread is still taken back, and the record says the return is unconfirmed", async (t) => {
  const browser = installBrowser(t, { statuses: { "doc-limited": 429, "doc-pressed": 200 }, pressedUrl: new Error("No tab with id: 41.") });
  const result = await clickOntoLimitedPage(browser, stillPace());
  assert.equal(result.failure?.code, "web.action.rate_limited");
  assert.equal(browser.wentBack, 1);
  assert.match(
    actualOf(result),
    /; the tab was taken back to \/scenarios\/everything-store\/s, but whether that is the page the click was pressed on is unconfirmed, because the address before the click went unread; /u
  );
});

test("a click that lands on a page served 404 is still navigation_unexpected, is not taken back, and the pace hears of no refusal", async (t) => {
  const pace = stillPace();
  const browser = installBrowser(t, { statuses: { "doc-limited": 404 } });
  const result = await clickOntoLimitedPage(browser, pace);
  assert.equal(result.failure?.code, "web.navigation.unexpected");
  assert.equal(result.failure?.retryAfterMs, undefined);
  assert.equal(actualOf(result), `the server answered HTTP 404 for ${LIMITED_PATH}`);
  assert.equal(pace.refusalsOf(STORE_ORIGIN), 0);
  assert.equal(browser.wentBack, 0);
});

test("a robot check served 429 is still the person's, is not told to the pace, and the tab stays on it", async (t) => {
  const pace = stillPace();
  const browser = installBrowser(t, { statuses: { "doc-limited": 429 } });
  const result = await clickOntoLimitedPage(browser, pace, PERSON_ONLY_CHECK);
  assert.equal(result.failure?.code, "web.intervention.required");
  assert.equal(pace.refusalsOf(STORE_ORIGIN), 0);
  assert.equal(browser.wentBack, 0);
  assert.deepEqual(browser.injections, [], "a check decides the landing before the status is read");
});

test("a click that lands on a page served 200 is not taken back and tells the pace nothing", async (t) => {
  const pace = stillPace();
  const browser = installBrowser(t, { statuses: { "doc-limited": 200 } });
  const result = await clickOntoLimitedPage(browser, pace);
  assert.equal(result, REPLY);
  assert.equal(browser.wentBack, 0);
  assert.equal(pace.refusalsOf(STORE_ORIGIN), 0);
});
