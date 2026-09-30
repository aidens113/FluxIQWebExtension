// The room a command is given to wait out a check that clears by itself, and the
// timeout every other wait keeps.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_CHECK_WAIT_MS, webAutomationActionWaitsOutChecks, webAutomationBaseTimeoutMs, webAutomationCheckWaitNode, webAutomationCheckWaitParameters } from "../check-wait";

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

test("a node gets the allowance on its own timeout, or on Core's 5 s default, once", () => {
  const recorded = webAutomationCheckWaitNode("web.dom.click", { parameters: { selector: "#go" } });
  assert.deepEqual(recorded, { parameters: { selector: "#go", checkWaitMs: 15_000 }, timeoutMs: 20_000 });
  assert.deepEqual(webAutomationCheckWaitNode("web.dom.click", recorded), recorded, "given twice, carried once");
  assert.equal(webAutomationCheckWaitNode("web.browser.navigate", { parameters: { url: "https://a.test/" }, timeoutMs: 8_000 }).timeoutMs, 23_000);
  const typed = { parameters: { selector: "#q", text: "x" }, timeoutMs: 5_000 };
  assert.equal(webAutomationCheckWaitNode("web.dom.type", typed), typed);
});

test("dispatched parameters get the allowance on the timeout they name, once, and name none when they named none", () => {
  const built = webAutomationCheckWaitParameters("web.dom.click", { selector: "#go", timeoutMs: 10_000 });
  assert.deepEqual(built, { selector: "#go", timeoutMs: 25_000, checkWaitMs: 15_000 });
  assert.deepEqual(webAutomationCheckWaitParameters("web.dom.click", built), built, "given twice, carried once");
  assert.deepEqual(webAutomationCheckWaitParameters("web.browser.navigate", { url: "https://a.test/" }), { url: "https://a.test/", checkWaitMs: 15_000 });
  const typed = { selector: "#q", timeoutMs: 5_000 };
  assert.equal(webAutomationCheckWaitParameters("web.dom.type", typed), typed);
});
