// A lasting press a build runs against the live page -- exploring, or replaying
// its draft in a test -- is made again only when its failure shows it did not
// happen, counts as done when the caller's effect check shows it landed, and
// otherwise is not repeated and says its outcome is uncertain (t359, the
// user's rule of 2026-10-07). A node whose act does not last keeps the first
// attempt and three retries (t355).
//
// The page is stubbed at the gateway with the records the extension really
// sends (`content/action-runtime/results.ts`, built from the closed set's rows).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../../../../failure";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { webNodeDispatchWithRetries, type WebNodeDispatchResult } from "..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const EXTRACT = "web.output.dom-extract";
const ITEM = "https://crossborder.example.test/item/1005008123450";
const PERMITTED = async () => ({ permitted: true as const });

function failed(code: WebAutomationFailureCode): WebNodeDispatchResult {
  return { status: "failed", failure: webAutomationFailureRecord(code, { expected: "the press", actual: "not yet" }) as unknown as JsonObject, error: code };
}

// Every command that reaches the page counts on its cart line, as a real Add to
// cart answers, so a press that landed is never taken for one that changed
// nothing (t511) and pressed once more.
function page(sent = 0): JsonObject {
  return {
    url: ITEM,
    title: "Voltbay USB C Hub",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      { tagName: "span", selector: "#price", visibleText: "$12.99" },
      { tagName: "span", selector: "#cart", visibleText: `Cart: ${sent} sent` }
    ]
  };
}

/** The item page, whose `actionType` answers `answers` in turn and then succeeds. Counts every command of that type. */
function itemPage(actionType: string, answers: readonly WebNodeDispatchResult[]) {
  const sent: number[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === actionType) {
        sent.push(sent.length + 1);
        return answers[sent.length - 1] ?? { status: "succeeded", payload: { value: "ok" } };
      }
      return { status: "succeeded", payload: { snapshot: page(sent.length) } };
    }
  };
  return { gateway, sent };
}

async function exploreAddToCart(gateway: WebLlmEvidenceGateway) {
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const add = shownHandle(looked.evidence, "Add to cart");
  return await runtime.executeTool({ ...PROJECT, callId: "add", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK, parameters: { target: { handle: add } }, consequences: ["create_new"] } });
}

test("exploring: a lasting press that failed before it was dispatched is made again and succeeds", async () => {
  const site = itemPage("web.dom.click", [failed(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND), failed(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED)]);
  const pressed = await exploreAddToCart(site.gateway);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.deepEqual(site.sent, [1, 2, 3]);
});

test("exploring: a lasting press whose answer was lost after it was dispatched is never pressed again", async () => {
  for (const code of [WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]) {
    const site = itemPage("web.dom.click", [failed(code), failed(code)]);
    const pressed = await exploreAddToCart(site.gateway);
    assert.equal(pressed.effectApplied, false, `${code} is answered, not pressed again`);
    assert.deepEqual(site.sent, [1], `${code} after the press may have landed`);
  }
});

test("replaying: a lasting press whose answer was lost after it was dispatched is never pressed again", async () => {
  const site = itemPage("web.dom.click", [failed(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED), failed(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED)]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#add" }, consequences: ["create_new"], from: { location: ITEM } } });
  assert.deepEqual(site.sent, [1]);
});

test("a read keeps the first attempt and three retries on the same fault", async () => {
  const action = failed(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  const site = itemPage("web.dom.extract", [action, action, action, action, action]);
  const outcome = await webNodeDispatchWithRetries(
    { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "price", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
    { definitionId: EXTRACT, effect: "observe" },
    { actionType: "web.dom.extract", parameters: { selector: "#price" }, metadata: {} }
  );
  assert.deepEqual(site.sent, [1, 2, 3, 4]);
  assert.equal(outcome.attempts, 4);
  assert.equal(outcome.lastingAct, undefined);
});

/** One dispatch of a press under the default retries, with the caller's effect check. */
async function pressWithCheck(answers: readonly WebNodeDispatchResult[], verdict?: "landed" | "not_landed" | "unknown") {
  const site = itemPage("web.dom.click", answers);
  const asked: number[] = [];
  const outcome = await webNodeDispatchWithRetries(
    { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "add", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
    { definitionId: CLICK, effect: "mutate" },
    { actionType: "web.dom.click", parameters: { selector: "#add" }, metadata: {} },
    undefined,
    verdict ? async (_result, attempt) => { asked.push(attempt); return verdict; } : undefined
  );
  return { outcome, sent: site.sent, asked };
}

test("a lasting press that failed after dispatch and the effect check shows landed is not pressed again, and counts as done", async () => {
  const { outcome, sent, asked } = await pressWithCheck([failed(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED)], "landed");
  assert.deepEqual(sent, [1]);
  assert.deepEqual(asked, [1]);
  assert.equal(outcome.lastingAct, "landed");
});

test("a lasting press is made again only once the effect check shows it did not land", async () => {
  const { outcome, sent } = await pressWithCheck([failed(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED)], "not_landed");
  assert.deepEqual(sent, [1, 2]);
  assert.equal(outcome.result.status, "succeeded");
  assert.equal(outcome.lastingAct, undefined);
});

test("a lasting press whose effect cannot be determined ends uncertain without a second press", async () => {
  for (const verdict of ["unknown", undefined] as const) {
    const { outcome, sent } = await pressWithCheck([failed(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED), failed(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED)], verdict);
    assert.deepEqual(sent, [1]);
    assert.equal(outcome.lastingAct, "uncertain");
    assert.equal(outcome.attempts, 1);
  }
});


test("trusted commit floors hold bare failures and throws despite spoofed observe metadata", async () => {
  for (const actionType of ["web.browser.download", "web.browser.tab", "web.dom.next_page", "web.dom.type"]) {
    for (const throws of [false, true]) {
      let sent = 0;
      const gateway: WebLlmEvidenceGateway = {
        eligibleSessionIds: () => ["session.one"],
        executeAction: async () => {
          sent += 1;
          if (throws) throw new Error("acknowledgement lost");
          return { status: "timed_out" };
        }
      };
      const outcome = await webNodeDispatchWithRetries(
        { gateway, sessionId: "session.one", request: { ...PROJECT, callId: "floor", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
        { definitionId: actionType, effect: "observe", declared: [] },
        { actionType, parameters: actionType === "web.dom.type" ? { submit: { binding: "unresolved", fallback: false } } : {}, metadata: { effect: "observe", actionEffect: { effectClass: "observe" }, idempotent: true } }
      );
      assert.equal(sent, 1, `${actionType} throws=${throws}`);
      assert.equal(outcome.lastingAct, "uncertain");
    }
  }
});

test("new commit kinds still retry a proven unacted failure or not-landed effect", async () => {
  for (const actionType of ["web.browser.download", "web.browser.tab", "web.dom.next_page"]) {
    for (const code of [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED]) {
      const site = itemPage(actionType, [failed(code)]);
      const outcome = await webNodeDispatchWithRetries(
        { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "floor", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
        { definitionId: actionType, effect: "mutate", declared: [] },
        { actionType, parameters: {}, metadata: {} }, undefined, async () => "not_landed"
      );
      assert.deepEqual(site.sent, [1, 2], actionType);
      assert.equal(outcome.result.status, "succeeded");
    }
  }
});


test("forced and unresolved new-tab navigation stays uncertain at the actual dispatch seam", async () => {
  for (const newTab of [true, { $state: { path: "tab", fallback: false } }]) {
    const site = itemPage("web.browser.navigate", [failed(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT)]);
    const outcome = await webNodeDispatchWithRetries(
      { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "new-tab", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
      { definitionId: "web.output.browser-navigate", effect: "mutate", declared: [] },
      { actionType: "web.browser.navigate", parameters: { url: ITEM, newTab }, metadata: { effect: "observe", idempotent: true } }
    );
    assert.deepEqual(site.sent, [1]);
    assert.equal(outcome.lastingAct, "uncertain");
  }
});

test("trusted replacement-state safety cannot erase a declared lasting consequence", async () => {
  for (const actionType of ["web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.check", "web.browser.navigate"]) {
    const site = itemPage(actionType, [failed(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT)]);
    const outcome = await webNodeDispatchWithRetries(
      { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "lasting-state", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
      { definitionId: actionType, effect: "mutate", declared: ["modify_existing"] },
      { actionType, parameters: { selector: "#field", text: "replacement", checked: true, url: ITEM }, metadata: { effect: "observe", idempotent: true } }
    );
    assert.deepEqual(site.sent, [1], actionType);
    assert.equal(outcome.lastingAct, "uncertain", actionType);
  }
});


test("inspected clear and select replacement setters preserve retries after ambiguous and verification failures", async () => {
  for (const actionType of ["web.dom.clear", "web.dom.select"]) {
    for (const code of [WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED]) {
      const site = itemPage(actionType, [failed(code)]);
      const outcome = await webNodeDispatchWithRetries(
        { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "replacement", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
        { definitionId: actionType, effect: "mutate", declared: [] },
        { actionType, parameters: { selector: "#field", value: "desired-option" }, metadata: {} }
      );
      assert.deepEqual(site.sent, [1, 2], `${actionType} ${code}`);
      assert.equal(outcome.result.status, "succeeded");
      assert.equal(outcome.lastingAct, undefined);
    }
  }
});
