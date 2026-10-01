// T1 coverage of action-runner.ts's navigate branch: which tab a navigation
// drives, whether it arrived, and whether the page it landed on is a robot
// check a person has to answer. Split from `action-runner.test.ts`, whose rows
// are about delivering an action to a frame.
//
// The chrome API the runner drives is stubbed and read back, as there. What
// this cannot prove is that a real page's top frame answers the robot-check
// question; `content/action-runtime/tests/challenge-evidence.test.ts` covers
// its reading of words, and only a loaded extension proves the round trip.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { runBrowserActionCommand } from "../action-runner";
import { currentAutomationTabId, forgetAutomationTab, setAutomationTab } from "../automation-tab";

/** One `chrome.tabs.sendMessage` the runner made: the tab, the body, and the frame it addressed. */
type SentToTab = { tabId: number; message: Record<string, unknown>; frameId: number | undefined };

// Which tab a navigation drives, and whether it arrived. A navigation that named
// no tab used to go to the tab this worker last drove, or to a new one, while
// the next action ran on the page in front and Core's snapshot read that page
// too: the created Flow of E1 lane B, E9, "navigated" in a tab nobody looked at
// and then failed on the start page it had never left.

/**
 * `page` is what the landed page's top frame answers when asked whether it is a
 * challenge (`fluxiq.pageChallenge`): absent, the frame answers nothing, as a
 * page with no content script does; `"silent"`, it never answers at all. A
 * list is answered in turn, its last answer for ever after: a check that lifts
 * by itself.
 */
type PageAnswer = { challenge: string | null; robotCheck?: string };
type BrowserTab = {
  url: string | undefined;
  loadFailed?: boolean;
  title?: string;
  document?: number;
  ignores?: boolean;
  page?: PageAnswer | "silent" | PageAnswer[];
};

/**
 * Tabs whose URL a navigation changes, with every update and creation
 * recorded.
 *
 * A tab also carries the top frame's document number, which the stub
 * increments for every load it performs -- that is what Chrome's document UUID
 * is, and it is the only evidence that a navigation to the address a tab
 * already shows did any work. A tab marked `ignores` acts like a browser that
 * did not carry the request out: it accepts the call and changes nothing.
 */
function installNavigationStub(tabs: Record<number, BrowserTab>): { updated: number[]; created: string[]; reloaded: number[]; asked: SentToTab[] } {
  const calls = { updated: [] as number[], created: [] as string[], reloaded: [] as number[], asked: [] as SentToTab[] };
  const loaded = (tabId: number) => {
    const tab = tabs[tabId]!;
    if (tab.ignores !== true) tab.document = (tab.document ?? 0) + 1;
  };
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {},
    tabs: {
      get: (tabId: number) => tabs[tabId]
        ? Promise.resolve({ id: tabId, url: tabs[tabId]!.url, title: tabs[tabId]!.title, status: "complete" })
        : Promise.reject(new Error(`No tab with id: ${tabId}.`)),
      update: (tabId: number, properties: { url?: string }) => {
        calls.updated.push(tabId);
        if (properties.url !== undefined && tabs[tabId]!.ignores !== true) {
          tabs[tabId]!.url = properties.url;
          loaded(tabId);
        }
        return Promise.resolve({ id: tabId, url: tabs[tabId]!.url });
      },
      reload: (tabId: number) => {
        calls.reloaded.push(tabId);
        loaded(tabId);
        return Promise.resolve();
      },
      create: (properties: { url: string }) => {
        calls.created.push(properties.url);
        tabs[900] = { url: properties.url, document: 1 };
        return Promise.resolve({ id: 900, url: properties.url });
      },
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (tabId: number, message: unknown, options: { frameId?: number }, callback: (response: unknown) => void) => {
        calls.asked.push({ tabId, message: message as Record<string, unknown>, frameId: options.frameId });
        const page = tabs[tabId]?.page;
        if (Array.isArray(page)) {
          callback(page[0]);
          if (page.length > 1) page.shift();
          return;
        }
        if (page !== "silent") callback(page);
      }
    },
    webNavigation: {
      getAllFrames: (details: { tabId: number }, callback: (found: unknown[]) => void) =>
        callback([{
          frameId: 0,
          errorOccurred: tabs[details.tabId]?.loadFailed === true,
          documentId: `document.${tabs[details.tabId]?.document ?? 0}`
        }])
    }
  };
  return calls;
}

async function navigate(url: string, activeTabId: number | undefined, ownOrigins?: readonly string[], timeoutMs?: number): Promise<Awaited<ReturnType<typeof runBrowserActionCommand>>> {
  try {
    return await runBrowserActionCommand({
      action: { commandId: "c-nav", actionType: "web.browser.navigate", url, ...(timeoutMs !== undefined ? { timeoutMs } : {}) },
      ...(activeTabId !== undefined ? { activeTabId } : {}),
      ...(ownOrigins ? { ownOrigins } : {}),
      attachTabForRecording: () => Promise.resolve()
    });
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

const STORE = "http://127.0.0.1:64130/scenarios/everything-store/";
const RESULTS = "http://127.0.0.1:64130/scenarios/everything-store/s?k=wireless+earbuds";

test("a navigation drives the page in front, not the tab it last drove, and that page is where it reports arriving", async () => {
  forgetAutomationTab();
  setAutomationTab(12);
  const calls = installNavigationStub({ 12: { url: "http://127.0.0.1:64130/elsewhere" }, 41: { url: STORE } });
  const run = await navigate(RESULTS, 41);
  assert.deepEqual(calls.updated, [41]);
  assert.deepEqual(calls.created, []);
  assert.equal(run.tabId, 41);
  assert.equal(run.result.status, "succeeded");
  assert.equal(run.result.url, RESULTS);
  assert.equal(currentAutomationTabId(), 41, "the page driven is the automation tab from here on");
});

test("with FluxIQ's own panel in front, a navigation opens a page of its own instead of taking the panel over", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 5: { url: "http://127.0.0.1:3300/programs/automation-studio" } });
  const run = await navigate(RESULTS, 5, ["http://127.0.0.1:3300"]);
  assert.deepEqual(calls.updated, []);
  assert.deepEqual(calls.created, [RESULTS]);
  assert.equal(run.tabId, 900);
  assert.equal(run.result.status, "succeeded");
});

test("a navigation whose page the browser could not load fails, though the address bar shows the URL", async () => {
  forgetAutomationTab();
  installNavigationStub({ 41: { url: STORE, loadFailed: true } });
  const run = await navigate(RESULTS, 41);
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.message, `The browser could not load ${RESULTS}.`);
  assert.deepEqual(run.result.failure, {
    category: "navigation_unexpected",
    code: "web.navigation.unexpected",
    retryable: false,
    stage: "confirmation",
    expected: RESULTS,
    actual: `the browser could not load ${RESULTS}`
  });
});

test("a navigation the browser did not carry out fails, though the tab is at the requested address", async () => {
  // The campaign's created Flow, in one row: the opening navigate names the
  // page the tab is already on, the browser does nothing, and the address the
  // post-condition compares is right either way. Only the document says so.
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, title: "Brightaisle", ignores: true } });
  const run = await navigate(STORE, 41);

  assert.deepEqual(calls.reloaded, [41], "the reload was asked for");
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.failure?.code, "web.navigation.unexpected");
  assert.match(run.result.message ?? "", /already showing/u);
  assert.equal(run.result.url, STORE, "and the result still says where the tab is");
});

test("a navigation the browser did carry out succeeds, and says what the tab did and which page it reached", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, title: "Brightaisle" } });
  const run = await navigate(STORE, 41);

  assert.deepEqual(calls.reloaded, [41]);
  assert.equal(run.result.status, "succeeded");
  assert.equal(run.result.title, "Brightaisle", "the page's own name is evidence a worker-side result can carry");
  const validation = run.result.validation;
  assert.equal(validation.status, "passed");
  assert.match(validation.status === "passed" ? validation.actual : "", /loaded the page again/u);
});

test("a browser that will not say which document a tab holds is reported, never failed", async () => {
  forgetAutomationTab();
  (globalThis as { chrome?: unknown }).chrome = undefined;
  const calls = installNavigationStub({ 41: { url: STORE } });
  // No documentId at all: `getAllFrames` answers frames without one, as an
  // older browser or a refused permission would.
  const chrome = (globalThis as { chrome?: { webNavigation: { getAllFrames: unknown } } }).chrome!;
  chrome.webNavigation.getAllFrames = (_details: { tabId: number }, callback: (found: unknown[]) => void) => callback([{ frameId: 0 }]);
  const run = await navigate(STORE, 41);

  assert.deepEqual(calls.reloaded, [41]);
  assert.equal(run.result.status, "succeeded", "an unreadable document is not evidence of a no-op");
});

// A navigation that lands on a robot check. The crossborder marketplace serves
// its traffic screen in place of every third results page, at the address that
// was asked for, and live runs 15 and 17 (`run-munoeac4-33c17306`,
// `run-munp80f5-c31ea417`) navigated onto it nine to eleven times, each one
// reported `web.action.succeeded`, so the build kept spending decisions on a
// page only a person may answer. The worker cannot read a page, so it asks the
// landed page's top frame; what the frame reads is `challenge-evidence.ts`'s.

const TRAFFIC_SCREEN = { challenge: "captcha" } as const;

test("a navigation that lands on a robot check says a person is needed, never that it succeeded", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, title: "Security check", page: TRAFFIC_SCREEN } });
  const run = await navigate(RESULTS, 41);

  assert.deepEqual(calls.asked, [{ tabId: 41, message: { type: "fluxiq.pageChallenge" }, frameId: 0 }], "the landed page's top frame was asked");
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.failure?.code, "web.intervention.required");
  assert.equal(run.result.failure?.retryable, false);
  assert.match(run.result.failure?.actual ?? "", /^captcha: /u, "the closed challenge word leads the record, as a refusal's reason does");
  assert.match(run.result.message ?? "", /robot check/u);
  assert.equal(run.result.url, RESULTS, "the result still says where the tab is");
  const validation = run.result.validation;
  assert.equal(validation.status, "failed");
  assert.ok(parseAutomationStudioFailureRecord(run.result.failure), "Core's parser accepts the record");
});

test("a navigation redirected onto a robot check says a person is needed, not that it landed somewhere else", async () => {
  forgetAutomationTab();
  installNavigationStub({ 41: { url: STORE, page: TRAFFIC_SCREEN } });
  const chrome = (globalThis as { chrome?: { tabs: { update: (tabId: number, properties: { url?: string }) => Promise<unknown> } } }).chrome!;
  const update = chrome.tabs.update;
  chrome.tabs.update = (tabId, properties) => update(tabId, { url: `${STORE}errors/validate-captcha?return=${encodeURIComponent(properties.url ?? "")}` });
  const run = await navigate(RESULTS, 41);

  assert.equal(run.result.failure?.code, "web.intervention.required");
  assert.doesNotMatch(run.result.failure?.actual ?? "", /return=/u, "the landed address, which may carry a return path, is not quoted");
});

test("a navigation onto an ordinary page the top frame vouches for still succeeds", async () => {
  forgetAutomationTab();
  installNavigationStub({ 41: { url: STORE, page: { challenge: null } } });
  const run = await navigate(RESULTS, 41);
  assert.equal(run.result.status, "succeeded");
  assert.equal("checkWait" in run.result, false, "no check stood, so no wait is said");
});

test("a navigation onto a page asking for a verification code is left to the steps after it", async () => {
  // Only a robot check is judged at arrival: a page's headings may name
  // two-factor authentication on an ordinary settings page, so a code prompt is
  // the person's only when an action's target is then missing from it
  // (`results.ts`), as before.
  forgetAutomationTab();
  installNavigationStub({ 41: { url: STORE, page: { challenge: "credential" } } });
  const run = await navigate(RESULTS, 41);
  assert.equal(run.result.status, "succeeded");
});

test("a landed page whose top frame never answers leaves the navigation's result as it was", async () => {
  forgetAutomationTab();
  installNavigationStub({ 41: { url: STORE, page: "silent" } });
  const run = await navigate(RESULTS, 41);
  assert.equal(run.result.status, "succeeded", "missing evidence is never a failure");
  const validation = run.result.validation;
  assert.match(validation.status === "passed" ? validation.actual : "", /robot check went unread: the top frame did not answer within 1000 ms/u, "and the validation says the page went unread");
});

test("a page the browser could not load is not asked about, and stays a load failure", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, loadFailed: true, page: TRAFFIC_SCREEN } });
  const run = await navigate(RESULTS, 41);
  assert.deepEqual(calls.asked, []);
  assert.equal(run.result.failure?.code, "web.navigation.unexpected");
});

// A check that clears by itself. bigbox-retail's "Robot or human?" page checks
// again automatically after 8 s, auction-marketplace's "Checking your browser"
// page moves on after 5 s; a reload restarts either. So the navigation waits
// where it stands, asking the page again, and judges the page behind it.

const SELF_CLEARING_CHECK = { challenge: "captcha", robotCheck: "self_clearing" } as const;
const ORDINARY_PAGE = { challenge: null } as const;

test("a navigation that lands on a check which clears by itself waits it out untouched, then succeeds on the page behind it", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, page: [SELF_CLEARING_CHECK, ORDINARY_PAGE] } });
  const run = await navigate(RESULTS, 41);

  assert.equal(run.result.status, "succeeded");
  assert.deepEqual(calls.reloaded, [], "the check was never reloaded");
  assert.deepEqual(calls.updated, [41], "nor navigated again");
  assert.ok(calls.asked.length >= 3, "the page was asked again until it was no check, and once more after it settled");
  const validation = run.result.validation;
  assert.match(validation.status === "passed" ? validation.actual : "", /a robot check stood on the page and cleared by itself after \d+ ms, untouched/u);
  // The same wait as a fact, the number the prose quotes.
  const waitedMs = run.result.checkWait?.waitedMs;
  assert.equal(typeof waitedMs, "number");
  assert.ok(Number.isInteger(waitedMs) && waitedMs! >= 0);
  assert.deepEqual(Object.keys(run.result.checkWait ?? {}), ["waitedMs"]);
  assert.match(validation.status === "passed" ? validation.actual : "", new RegExp(`cleared by itself after ${waitedMs} ms`, "u"));
});

test("a check that says it clears by itself and has not within the command's time is the person's", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, page: SELF_CLEARING_CHECK } });
  // 2.5 s leaves 1.5 s to wait once the 1 s reply margin is kept back.
  const run = await navigate(RESULTS, 41, undefined, 2_500);

  assert.equal(run.result.status, "failed");
  assert.equal(run.result.failure?.code, "web.intervention.required");
  assert.match(run.result.failure?.actual ?? "", /^captcha: the page the browser landed on is a robot check that said it would clear by itself and had not after \d+ ms/u);
  assert.match(run.result.message ?? "", /did not clear by itself/u);
  assert.equal(run.result.checkWait, undefined, "a check that did not clear is no cleared wait");
  assert.deepEqual(calls.reloaded, []);
  assert.ok(parseAutomationStudioFailureRecord(run.result.failure), "Core's parser accepts the record");
});

test("a check that says it is checking and then asks for a person is the person's at once", async () => {
  forgetAutomationTab();
  installNavigationStub({ 41: { url: STORE, page: [SELF_CLEARING_CHECK, TRAFFIC_SCREEN] } });
  const run = await navigate(RESULTS, 41);
  assert.equal(run.result.failure?.code, "web.intervention.required");
  assert.match(run.result.failure?.actual ?? "", /asked for what only a person can answer/u);
  assert.equal(run.result.checkWait, undefined, "a check that turned to a person is no cleared wait");
});

// A navigation to the address the tab already shows used to be a reload
// (`automation-tab.ts`), and the check is served at that very address: each
// reload asked again, and a countdown started over (the crossborder builds of
// 2026-09-29). A tab showing a check is never reloaded.

test("a navigation to the address a tab already shows, while it shows a check only a person can answer, does not reload it", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: RESULTS, page: TRAFFIC_SCREEN } });
  const run = await navigate(RESULTS, 41);

  assert.deepEqual(calls.reloaded, [], "no reload was issued");
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.failure?.code, "web.intervention.required", "the check is the person's, not a navigation that went nowhere");
});

test("a navigation to the address a tab already shows, while a self-clearing check stands there, waits it out and succeeds without reloading", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: RESULTS, page: [SELF_CLEARING_CHECK, SELF_CLEARING_CHECK, ORDINARY_PAGE] } });
  const run = await navigate(RESULTS, 41);

  assert.deepEqual(calls.reloaded, []);
  assert.equal(run.result.status, "succeeded", "an unmoved tab behind a check is not NAVIGATION_UNEXPECTED");
  const validation = run.result.validation;
  assert.match(validation.status === "passed" ? validation.actual : "", /already at that address behind a robot check, so it was not loaded again/u);
});

test("a navigation to the address a tab already shows, with no check on it, still reloads it", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: RESULTS, page: ORDINARY_PAGE } });
  const run = await navigate(RESULTS, 41);
  assert.deepEqual(calls.reloaded, [41]);
  assert.equal(run.result.status, "succeeded");
});

test("a frame from before the distinction, answering a robot check with no word on who clears it, is read as the person's", async () => {
  forgetAutomationTab();
  const calls = installNavigationStub({ 41: { url: STORE, page: { challenge: "captcha" } } });
  const run = await navigate(RESULTS, 41);
  assert.equal(run.result.failure?.code, "web.intervention.required");
  assert.equal(calls.asked.length, 1, "and nothing was waited for");
});
