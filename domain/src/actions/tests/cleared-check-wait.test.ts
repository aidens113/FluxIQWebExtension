// The cleared wait as it may travel: whole milliseconds within ten minutes,
// `waitedMs` alone, and nothing for a value that is not one.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_CLEARED_CHECK_WAIT_MAX_MS, webAutomationClearedCheckWaitValue } from "../cleared-check-wait";

test("a wait within the bound is copied as whole milliseconds", () => {
  assert.deepEqual(webAutomationClearedCheckWaitValue({ waitedMs: 0 }), { waitedMs: 0 });
  assert.deepEqual(webAutomationClearedCheckWaitValue({ waitedMs: 8_412.4 }), { waitedMs: 8_412 });
  assert.deepEqual(webAutomationClearedCheckWaitValue({ waitedMs: WEB_AUTOMATION_CLEARED_CHECK_WAIT_MAX_MS }), { waitedMs: 600_000 });
});

test("only waitedMs travels", () => {
  assert.deepEqual(webAutomationClearedCheckWaitValue({ waitedMs: 5_000, outcome: "cleared", page: "Checking your browser" }), { waitedMs: 5_000 });
});

test("anything that is not a wait within ten minutes is nothing", () => {
  for (const value of [undefined, null, 5_000, "5000", [], {}, { waitedMs: "5000" }, { waitedMs: -1 }, { waitedMs: 600_001 }, { waitedMs: Number.POSITIVE_INFINITY }, { waitedMs: Number.NaN }]) {
    assert.equal(webAutomationClearedCheckWaitValue(value), undefined, JSON.stringify(value));
  }
});
