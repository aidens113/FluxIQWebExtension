// T1 coverage of browser-tab.ts: which open tab a switch selects, and the
// failure each operation reports when it cannot do what it was asked.
//
// The failures are covered here because the thing that must be right is the
// record's code, and a code outside the domain's closed set is one no consumer
// can name -- the six this module used to write by hand (`web.tab.*`) were in
// no set at all. `chrome.tabs` does not exist in this Node runner, so the four
// calls each failing path makes are stubbed and the record is read back. What
// this cannot prove is that a real browser fails in these ways; it proves that
// when it does, the failure is nameable.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, isWebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../shared/protocol";
import { currentAutomationTabId, forgetAutomationTab, setAutomationTab } from "../automation-tab";
import { runBrowserTabAction, selectTabForSwitch, type SwitchableTab } from "../browser-tab";

const tabs: SwitchableTab[] = [
  { id: 1, url: "https://example.test/" },
  { id: 2, url: "https://shop.example.test/checkout" },
  { id: 3, url: "https://shop.example.test/checkout/step-2" },
  { id: 4 }
];

test("a switch by id selects that tab", () => {
  assert.deepEqual(selectTabForSwitch(tabs, { tabId: 2 }), { id: 2, url: "https://shop.example.test/checkout" });
  assert.equal(selectTabForSwitch(tabs, { tabId: 99 }), undefined);
});

test("an id wins over a pattern, so a Flow that names a tab gets that tab", () => {
  assert.deepEqual(selectTabForSwitch(tabs, { tabId: 1, urlPattern: "checkout" }), { id: 1, url: "https://example.test/" });
});

test("a pattern matches anywhere in the URL, ignoring case, and the first match wins", () => {
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "checkout" })?.id, 2);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "CHECKOUT" })?.id, 2);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "step-2" })?.id, 3);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "nothing-here" }), undefined);
});

test("without an id or a pattern nothing is selected, rather than an arbitrary tab", () => {
  assert.equal(selectTabForSwitch(tabs, {}), undefined);
  assert.equal(selectTabForSwitch(tabs, { urlPattern: "" }), undefined);
  assert.equal(selectTabForSwitch([], { urlPattern: "checkout" }), undefined);
});

/** The `chrome.tabs` calls a tab operation makes, and what each answers. */
type TabsStub = {
  create?: () => Promise<{ id?: number }>;
  query?: (info: chrome.tabs.QueryInfo) => Promise<Array<SwitchableTab & { status?: string; active?: boolean }>>;
  remove?: (tabId: number) => Promise<void>;
  get?: (tabId: number) => Promise<{ id: number; url?: string }>;
  update?: (tabId: number, properties: chrome.tabs.UpdateProperties) => Promise<unknown>;
};

/** Runs one tab action against the stub, and puts the global back however it ends. */
async function runTabAction(action: BrowserActionCommand, tabs_: TabsStub): Promise<BrowserActionResult> {
  (globalThis as { chrome?: unknown }).chrome = { tabs: { update: () => Promise.resolve(), ...tabs_ } };
  try {
    return await runBrowserTabAction(action);
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

/** Every failure below must be one Core keeps and a consumer can name. */
function assertNameable(result: BrowserActionResult): void {
  assert.equal(result.status, "failed");
  assert.ok(isWebAutomationFailureCode(result.failure?.code), String(result.failure?.code));
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
}

test("a tab action with no operation is refused, and the refusal is nameable", async () => {
  const result = await runTabAction({ commandId: "t-none", actionType: "web.browser.tab" }, {});
  assertNameable(result);
  assert.deepEqual(result.failure, {
    // `web.tab.invalid_request` before: the set has one code for a refusal, and
    // which refusal it was is what `expected` and `actual` are for.
    category: "blocked_by_capability_or_policy",
    code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED,
    retryable: false,
    stage: "execution",
    expected: "operation open, switch, or close",
    actual: "no operation"
  });
});

test("a browser that refuses the operation outright is action_failed, carrying its own words", async () => {
  const result = await runTabAction(
    { commandId: "t-throw", actionType: "web.browser.tab", tab: { operation: "open" } },
    { create: () => Promise.reject(new Error("No tab with id 11.")) }
  );
  assertNameable(result);
  // `web.tab.failed` before. Not `UNKNOWN`, which means nothing said why: the
  // browser said why, and `actual` is where it says it.
  assert.deepEqual(result.failure, {
    category: "action_failed",
    code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED,
    retryable: true,
    stage: "execution",
    expected: "tab open to succeed",
    actual: "No tab with id 11."
  });
});

test("a tab opened without an id is action_failed, and says so without needing its old code", async () => {
  const result = await runTabAction(
    { commandId: "t-no-id", actionType: "web.browser.tab", tab: { operation: "open" } },
    { create: () => Promise.resolve({}) }
  );
  assertNameable(result);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  // The three `ACTION_FAILED` sites in this module share one code, so what
  // tells them apart is this pair. `web.tab.no_id` said nothing this does not.
  assert.equal(result.failure?.expected, "a new tab");
  assert.equal(result.failure?.actual, "a tab with no id");
});

test("a switch that matches no open tab is target_not_found, naming the tab it wanted", async () => {
  const result = await runTabAction(
    { commandId: "t-no-match", actionType: "web.browser.tab", tab: { operation: "switch", tabId: 11 } },
    { query: () => Promise.resolve([]) }
  );
  assertNameable(result);
  // `web.tab.no_match` before. The stage is `target_resolution`, written for
  // DOM elements and true of a tab as well: the tab is the thing the action
  // named, and it resolved to nothing. `action-runner.ts` already reports a
  // frame the same way.
  assert.deepEqual(result.failure, {
    category: "target_not_found",
    code: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND,
    retryable: true,
    stage: "target_resolution",
    expected: "tab 11 active",
    actual: "no open tab matched"
  });
});

test("a close with no tab named and none open is refused, distinguishably from the other refusal", async () => {
  forgetAutomationTab();
  const result = await runTabAction(
    { commandId: "t-no-target", actionType: "web.browser.tab", tab: { operation: "close" } },
    {}
  );
  assertNameable(result);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
  // Same code as the no-operation refusal above, and unmistakably not it.
  assert.equal(result.failure?.expected, "a tab to close");
  assert.equal(result.failure?.actual, "no tab named and none open");
});

test("a tab that is still open after a close is action_failed, naming the tab", async () => {
  const result = await runTabAction(
    { commandId: "t-not-closed", actionType: "web.browser.tab", tab: { operation: "close", tabId: 11 } },
    { remove: () => Promise.resolve(), get: () => Promise.resolve({ id: 11 }) }
  );
  assertNameable(result);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(result.failure?.expected, "tab 11 closed");
  assert.equal(result.failure?.actual, "tab 11 is still open");
});

// --- A recorded switch or close (P4) ------------------------------------------
//
// W15's shape: an order list whose path begins its detail page's path, and a
// detail tab that a link opens.

const LIST_URL = "https://lab.test/scenarios/multi-tab/";
const DETAILS_URL = "https://lab.test/scenarios/multi-tab/details?order=17";

/** Open tabs a close removes, and the tabs an operation brings to the front. */
function openTabs(ids: readonly number[]) {
  const open = new Set(ids);
  const fronted: number[] = [];
  const stub: TabsStub = {
    remove: async (tabId) => {
      open.delete(tabId);
    },
    get: async (tabId) => {
      if (!open.has(tabId)) throw new Error(`No tab with id: ${tabId}.`);
      return { id: tabId, url: tabId === 5 ? LIST_URL : DETAILS_URL };
    },
    update: async (tabId) => {
      fronted.push(tabId);
    }
  };
  return { fronted, stub };
}

test("a switch by path takes the tab at exactly that path, the newest of several, and never a browser page", () => {
  const open: SwitchableTab[] = [
    { id: 5, url: LIST_URL },
    { id: 6, url: DETAILS_URL },
    { id: 7, url: "https://other.test/scenarios/multi-tab/details" },
    { id: 8, url: "chrome-extension://abcdefghijklmnop/scenarios/multi-tab/" },
    { url: LIST_URL }
  ];
  assert.equal(selectTabForSwitch(open, { urlPath: "/scenarios/multi-tab/" })?.id, 5, "the list, not a detail page whose URL contains its path");
  assert.equal(selectTabForSwitch(open, { urlPath: "/scenarios/multi-tab/details" })?.id, 7, "the newest tab at that path");
  assert.equal(selectTabForSwitch(open, { urlPath: "/scenarios/multi-tab" }), undefined, "a path is not a prefix");
  assert.equal(selectTabForSwitch(open, { urlPath: "" }), undefined);
  assert.equal(selectTabForSwitch(open, { tabId: 6, urlPath: "/scenarios/multi-tab/" })?.id, 6, "an id still wins");
});

test("a switch by path waits for a tab still opening, fronts it, and remembers the tab the Flow was on", async () => {
  forgetAutomationTab();
  let lookups = 0;
  const list = { id: 5, url: LIST_URL, status: "complete" };
  const details = { id: 6, url: DETAILS_URL, status: "complete", openerTabId: 5 };
  const { fronted, stub } = openTabs([5, 6]);
  const result = await runTabAction(
    { commandId: "t-wait", actionType: "web.browser.tab", tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } },
    {
      ...stub,
      query: async (info) => {
        if (info.active) return [{ ...list, active: true }];
        lookups += 1;
        return lookups < 3 ? [list] : [list, details];
      }
    }
  );
  assert.equal(result.status, "succeeded", result.message);
  assert.equal(lookups, 3, "it looked again until the tab opened");
  assert.deepEqual(fronted, [6]);
  assert.equal(result.url, DETAILS_URL);
  assert.equal(currentAutomationTabId(), 6);
  forgetAutomationTab(6);
  assert.equal(currentAutomationTabId(), 5, "the list is remembered as the tab before it");
});

test("a switch by path whose tab never opens fails target_not_found once its timeout passes", async () => {
  const startedAt = Date.now();
  const result = await runTabAction(
    { commandId: "t-never", actionType: "web.browser.tab", timeoutMs: 250, tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } },
    { query: async () => [{ id: 5, url: LIST_URL, status: "complete" }] }
  );
  assertNameable(result);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  assert.equal(result.failure?.expected, "a tab at path \"/scenarios/multi-tab/details\" active");
  assert.equal(result.failure?.actual, "no open tab matched");
  assert.ok(Date.now() - startedAt >= 200, "it waited for the tab before failing");
});

test("closing the tab FluxIQ drives fronts the tab driven before it", async () => {
  forgetAutomationTab();
  setAutomationTab(5);
  setAutomationTab(6);
  const { fronted, stub } = openTabs([5, 6]);
  const result = await runTabAction({ commandId: "t-close", actionType: "web.browser.tab", tab: { operation: "close" } }, stub);
  assert.equal(result.status, "succeeded", result.message);
  assert.deepEqual(fronted, [5]);
  assert.equal(currentAutomationTabId(), 5);
  assert.equal(result.url, LIST_URL);
  assert.deepEqual(result.validation, { status: "passed", expected: "tab 6 closed", actual: "tab 6 closed; tab 5 active" });
});

test("a close passes over a remembered tab that has closed, and closing a tab FluxIQ is not driving fronts nothing", async () => {
  forgetAutomationTab();
  setAutomationTab(4);
  setAutomationTab(5);
  setAutomationTab(6);
  const first = openTabs([4, 6]);
  const closed = await runTabAction({ commandId: "t-close-gap", actionType: "web.browser.tab", tab: { operation: "close" } }, first.stub);
  assert.equal(closed.status, "succeeded", closed.message);
  assert.deepEqual(first.fronted, [4]);
  assert.equal(currentAutomationTabId(), 4);

  const second = openTabs([4, 9]);
  const other = await runTabAction({ commandId: "t-close-other", actionType: "web.browser.tab", tab: { operation: "close", tabId: 9 } }, second.stub);
  assert.equal(other.status, "succeeded", other.message);
  assert.deepEqual(second.fronted, []);
  assert.equal(currentAutomationTabId(), 4);
});

test("a switch to a tab the browser already fronted remembers the tab that opened it, so a close returns there", async () => {
  forgetAutomationTab();
  const { fronted, stub } = openTabs([5, 6]);
  const details = { id: 6, url: DETAILS_URL, status: "complete", openerTabId: 5 };
  const withQuery: TabsStub = {
    ...stub,
    query: async (info) => (info.active ? [{ ...details, active: true }] : [{ id: 5, url: LIST_URL, status: "complete" }, details])
  };
  const switched = await runTabAction({ commandId: "t-opened", actionType: "web.browser.tab", tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } }, withQuery);
  assert.equal(switched.status, "succeeded", switched.message);
  const closed = await runTabAction({ commandId: "t-opened-close", actionType: "web.browser.tab", tab: { operation: "close" } }, withQuery);
  assert.equal(closed.status, "succeeded", closed.message);
  assert.deepEqual(fronted, [6, 5]);
  assert.equal(currentAutomationTabId(), 5);
});
