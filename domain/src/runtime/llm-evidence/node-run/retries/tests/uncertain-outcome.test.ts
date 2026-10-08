// What a build is told about a lasting act Core did not repeat because its
// outcome is uncertain (t361, after t359): exploring and replaying its draft
// in a test, the step's refusal says `outcome_uncertain`, in plain words, and
// the act is sent once. A press the extension says never reached the page --
// a send refused before delivery, `effect: "unacted"` -- is made again and
// succeeds, which is what the extension's statement is for
// (`apps/extension/src/runtime/page-delivery.ts`).
//
// The page is stubbed at the gateway with the records the extension sends:
// the router's transport record (`browserActionFailure`, built from the closed
// set's row) with and without the undelivered statement.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../../../../failure";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { webNodeDispatchWithRetries, webNodeFailureRefusal, type WebNodeDispatchResult } from "..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const EXTRACT = "web.output.dom-extract";
const TYPE = "web.output.dom-type";
const NAVIGATE = "web.output.browser-navigate";
const ITEM = "https://crossborder.example.test/item/1005008123450";
const PERMITTED = async () => ({ permitted: true as const });
const CONNECTION_ERROR = "Could not establish connection. Receiving end does not exist.";
const PORT_CLOSED = "The message port closed before a response was received.";

/** A failed answer carrying the closed set's record for `code`, with the client's own statement when it made one. */
function failed(code: WebAutomationFailureCode, actual: string, effect?: "unacted"): WebNodeDispatchResult {
  const record = webAutomationFailureRecord(code, { expected: "the action to run", actual });
  return { status: "failed", failure: (effect === undefined ? record : { ...record, effect }) as unknown as JsonObject, error: actual };
}

/** The undelivered send: the transport code, stated unacted by the extension. */
const UNDELIVERED = failed(WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT, CONNECTION_ERROR, "unacted");
/** A send that reached the page, whose answer was lost when the page unloaded. */
const ANSWER_LOST = failed(WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT, PORT_CLOSED);

function page(): JsonObject {
  return {
    url: ITEM,
    title: "Voltbay USB C Hub",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "input", selector: "#q", type: "search", accessibleName: "Search", placeholder: "Search" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      { tagName: "span", selector: "#price", visibleText: "$12.99" }
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
      return { status: "succeeded", payload: { snapshot: page() } };
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

type Refusal = { ok: boolean; code: string; detail?: { reason: string; next?: string }; page?: unknown };

test("exploring: a press whose send never reached the page is made again, and succeeds", async () => {
  const site = itemPage("web.dom.click", [UNDELIVERED]);
  const pressed = await exploreAddToCart(site.gateway);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(pressed.effectApplied, true);
  assert.deepEqual(site.sent, [1, 2]);
});

test("exploring: a press whose answer was lost after it reached the page is not pressed again, and the model is told its outcome is uncertain", async () => {
  const site = itemPage("web.dom.click", [ANSWER_LOST, ANSWER_LOST]);
  const pressed = await exploreAddToCart(site.gateway);
  assert.deepEqual(site.sent, [1]);
  assert.equal(pressed.effectApplied, false);
  const refusal = pressed.evidence as unknown as Refusal;
  assert.equal(refusal.ok, false);
  // The code stays the failure's own; the reason is no longer "channel_to_page_failed", which says "run it again".
  assert.equal(refusal.code, "action_failed");
  assert.equal(refusal.detail?.reason, "outcome_uncertain");
  assert.match(refusal.detail?.next ?? "", /^Outcome uncertain: this step was sent to the page, but its answer does not show whether it took effect, so it was not made again automatically/u);
  // The page comes with it, so the model can look whether the press took effect.
  assert.equal(typeof refusal.page, "object");
});

test("exploring: any failure that leaves a lasting press's effect unknown is told the same way, under its own code", async () => {
  for (const [code, word] of [
    [WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, "page_changed"],
    [WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "action_timed_out"],
    [WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "action_failed"]
  ] as const) {
    const site = itemPage("web.dom.click", [failed(code, "lost"), failed(code, "lost")]);
    const refusal = (await exploreAddToCart(site.gateway)).evidence as unknown as Refusal;
    assert.deepEqual(site.sent, [1], code);
    assert.equal(refusal.code, word, code);
    assert.equal(refusal.detail?.reason, "outcome_uncertain", code);
  }
});

test("a read that fails the same way keeps its retries and its own reason", async () => {
  const site = itemPage("web.dom.extract", [ANSWER_LOST, ANSWER_LOST, ANSWER_LOST, ANSWER_LOST]);
  const outcome = await webNodeDispatchWithRetries(
    { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "price", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
    { definitionId: EXTRACT, effect: "observe" },
    { actionType: "web.dom.extract", parameters: { selector: "#price" }, metadata: {} }
  );
  assert.deepEqual(site.sent, [1, 2, 3, 4]);
  assert.equal(outcome.lastingAct, undefined);
  assert.equal(webNodeFailureRefusal(outcome.result, outcome.lastingAct).detail?.reason, "channel_to_page_failed");
});

test("replaying: a press whose answer was lost is not pressed again, and the test is told its outcome is uncertain", async () => {
  const site = itemPage("web.dom.click", [ANSWER_LOST, ANSWER_LOST]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const replayed = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#add" }, consequences: ["create_new"], from: { location: ITEM } } });
  assert.deepEqual(site.sent, [1]);
  assert.equal(replayed.resultCode, "core.replay.failed");
  assert.equal(replayed.resultReason, "outcome_uncertain");
  assert.equal((replayed.evidence as JsonObject).said, "the step was sent, and whether it took effect is uncertain (action_failed): it was not made again, since making it twice could do it twice");
});

test("replaying: a press whose send never reached the page is made again, and replays", async () => {
  const site = itemPage("web.dom.click", [UNDELIVERED]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const replayed = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#add" }, consequences: ["create_new"], from: { location: ITEM } } });
  assert.deepEqual(site.sent, [1, 2]);
  assert.equal(replayed.resultCode, "core.replay.replayed");
});

test("a failure Core did not settle as uncertain keeps the failure's own refusal", () => {
  assert.deepEqual(webNodeFailureRefusal(ANSWER_LOST, undefined), { code: "action_failed", detail: { reason: "channel_to_page_failed" } });
  assert.deepEqual(webNodeFailureRefusal(ANSWER_LOST, "landed").detail, { reason: "channel_to_page_failed" });
});

// t361: one definition of a lasting act on every path. Exploration and test
// replays used to mark every page-changing node as acting, so typing and
// navigation lost their retries after an ambiguous failure there, while
// playback kept them. Now only a committing act (a press, a key press, a
// dialog answer, typing that sends its form) or a call that declared a
// lasting consequence is held back.

/** Types into the Search box while exploring, with `submit` when asked and the declaration given. */
async function exploreTyping(gateway: WebLlmEvidenceGateway, submit: boolean, consequences: string[] = []) {
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const search = shownHandle(looked.evidence, "Search");
  const parameters: JsonObject = submit ? { target: { handle: search }, text: "usb hub", submit: true } : { target: { handle: search }, text: "usb hub" };
  return await runtime.executeTool({ ...PROJECT, callId: "type", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { node: TYPE, parameters, consequences } });
}

test("exploring: plain typing is typed again after an ambiguous failure, and succeeds", async () => {
  for (const answer of [ANSWER_LOST, failed(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "lost"), failed(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, "lost"), failed(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "lost")]) {
    const site = itemPage("web.dom.type", [answer, answer, answer]);
    const typed = await exploreTyping(site.gateway, false);
    assert.equal(typed.resultCode, "web.action.succeeded", JSON.stringify(typed.evidence).slice(0, 400));
    assert.deepEqual(site.sent, [1, 2, 3, 4]);
  }
});

test("exploring: a navigation is made again after an ambiguous failure, and arrives", async () => {
  const site = itemPage("web.browser.navigate", [failed(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "slow"), ANSWER_LOST]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  await runtime.executeTool({ ...PROJECT, callId: "initial.core.run_node", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: ITEM, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const went = await runtime.executeTool({ ...PROJECT, callId: "go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: ITEM, permission: PERMITTED,
    value: { node: NAVIGATE, parameters: { url: ITEM }, consequences: [] } });
  assert.equal(went.resultCode, "web.action.succeeded", JSON.stringify(went.evidence).slice(0, 400));
  assert.deepEqual(site.sent, [1, 2, 3]);
});

test("exploring: typing that sends its form is not typed again when its outcome is uncertain", async () => {
  const site = itemPage("web.dom.type", [ANSWER_LOST, ANSWER_LOST]);
  const typed = await exploreTyping(site.gateway, true, ["send_or_publish"]);
  assert.deepEqual(site.sent, [1]);
  assert.equal((typed.evidence as unknown as Refusal).detail?.reason, "outcome_uncertain");
});

test("exploring: plain typing whose call declared a lasting consequence is held back the same way", async () => {
  const site = itemPage("web.dom.type", [ANSWER_LOST, ANSWER_LOST]);
  const typed = await exploreTyping(site.gateway, false, ["modify_existing"]);
  assert.deepEqual(site.sent, [1]);
  assert.equal((typed.evidence as unknown as Refusal).detail?.reason, "outcome_uncertain");
});

test("replaying: plain typing is typed again after an ambiguous failure, and replays", async () => {
  const site = itemPage("web.dom.type", [ANSWER_LOST]);
  const runtime = createWebAutomationLlmEvidenceRuntime(site.gateway);
  const replayed = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: TYPE, parameters: { selector: "#q", text: "usb hub" }, consequences: [], from: { location: ITEM } } });
  assert.deepEqual(site.sent, [1, 2]);
  assert.equal(replayed.resultCode, "core.replay.replayed");
});

test("a navigation's node is described as a saved Flow's web node is, so it keeps every retry", async () => {
  const slow = failed(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, "slow");
  const site = itemPage("web.browser.navigate", [slow, slow, slow, slow]);
  const outcome = await webNodeDispatchWithRetries(
    { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
    { definitionId: NAVIGATE, effect: "mutate", declared: [] },
    { actionType: "web.browser.navigate", parameters: { url: ITEM }, metadata: {} }
  );
  // The first attempt and three retries, then the last answer: never uncertain.
  assert.deepEqual(site.sent, [1, 2, 3, 4]);
  assert.equal(outcome.lastingAct, undefined);
});

// t361: a failure found at verification of an act that does not last is made
// again too -- lane A types a quantity every run, and a field that reads back
// "1" after "3" was typed must be typed again. A click whose confirmation
// failed is not.

test("exploring: a plain type whose read-back does not match is typed again, and succeeds", async () => {
  const readBack = failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "the field holds \"1\"");
  const site = itemPage("web.dom.type", [readBack]);
  const typed = await exploreTyping(site.gateway, false);
  assert.equal(typed.resultCode, "web.action.succeeded", JSON.stringify(typed.evidence).slice(0, 400));
  assert.deepEqual(site.sent, [1, 2]);
});

test("a check whose verification failed is made again, at the dispatch seam", async () => {
  const unticked = failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "the box is not ticked");
  const site = itemPage("web.dom.check", [unticked, unticked]);
  const outcome = await webNodeDispatchWithRetries(
    { gateway: site.gateway, sessionId: "session.one", request: { ...PROJECT, callId: "gift", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } },
    { definitionId: "web.output.dom-check", effect: "mutate", declared: [] },
    { actionType: "web.dom.check", parameters: { selector: "#gift", checked: true }, metadata: {} }
  );
  assert.deepEqual(site.sent, [1, 2, 3]);
  assert.equal(outcome.result.status, "succeeded");
  assert.equal(outcome.lastingAct, undefined);
});

test("exploring: a click whose confirmation failed is not pressed again, and its outcome is uncertain", async () => {
  const unseen = failed(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "nothing answered the press");
  const site = itemPage("web.dom.click", [unseen, unseen]);
  const pressed = await exploreAddToCart(site.gateway);
  assert.deepEqual(site.sent, [1]);
  assert.equal((pressed.evidence as unknown as Refusal).detail?.reason, "outcome_uncertain");
});
