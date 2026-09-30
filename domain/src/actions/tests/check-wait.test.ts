// The room a command is given to wait out a check that clears by itself, and the
// timeout every other wait keeps.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_CHECK_WAIT_MS, webAutomationActionWaitsOutChecks, webAutomationBaseTimeoutMs } from "../check-wait";

test("only the actions that load or change the page are given the allowance", () => {
  assert.equal(webAutomationActionWaitsOutChecks("web.dom.click"), true);
  assert.equal(webAutomationActionWaitsOutChecks("web.browser.navigate"), true);
  for (const other of ["web.dom.type", "web.dom.extract_list", "web.dom.wait_for_selector", "web.page.capture_snapshot"]) {
    assert.equal(webAutomationActionWaitsOutChecks(other), false, other);
  }
});

test("the base timeout is the command's timeout less its allowance, and the timeout itself when it has none", () => {
  assert.equal(webAutomationBaseTimeoutMs({ timeoutMs: 5_000 + WEB_AUTOMATION_CHECK_WAIT_MS, checkWaitMs: WEB_AUTOMATION_CHECK_WAIT_MS }), 5_000);
  assert.equal(webAutomationBaseTimeoutMs({ timeoutMs: 5_000 }), 5_000);
  assert.equal(webAutomationBaseTimeoutMs({}), undefined);
  assert.equal(webAutomationBaseTimeoutMs({ timeoutMs: 0, checkWaitMs: 15_000 }), undefined);
  // An allowance as large as the timeout is malformed; the whole of it stays bounded.
  assert.equal(webAutomationBaseTimeoutMs({ timeoutMs: 10_000, checkWaitMs: 15_000 }), 10_000);
  assert.equal(webAutomationBaseTimeoutMs({ timeoutMs: 8_000, checkWaitMs: Number.NaN }), 8_000);
});
