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
import { forgetAutomationTab } from "../automation-tab";
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

/** The `chrome.tabs` calls a failing tab operation makes, and what each answers. */
type TabsStub = {
  create?: () => Promise<{ id?: number }>;
  query?: () => Promise<SwitchableTab[]>;
  remove?: () => Promise<void>;
  get?: () => Promise<{ id: number }>;
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
