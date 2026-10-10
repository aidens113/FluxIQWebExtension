// The effect check a build's exploration and test replays pass Core's retries
// (plan B3, Core C8): a lasting act whose answer was lost is judged against the
// node's own declared expected state, `landed`, `not_landed` or `unknown`, and
// with no evidence the answer is `unknown` -- never "did not happen".
//
// The page is stubbed at the gateway: the press answers what each row gives it,
// and every `web.dom.assert` the evaluator sends answers `assertAnswer`.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../../../failure";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";
import { webNodeDispatchWithRetries, webNodeEffectCheck, type WebNodeDispatchResult } from "..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const ITEM = "https://crossborder.example.test/item/1005008123450";
const PERMITTED = async () => ({ permitted: true as const });
const ADDED = { conditions: [{ kind: "text", expected: "Added to cart" }] };

/** A press whose answer was lost after it was dispatched: retryable, and not stated `unacted`. */
const LOST: WebNodeDispatchResult = {
  status: "failed",
  failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, { expected: "the press", actual: "the page changed" }) as unknown as JsonObject,
  error: "web.page.changed"
};

function site(pressAnswers: readonly WebNodeDispatchResult[], assertAnswer: () => Promise<WebNodeDispatchResult>) {
  const presses: number[] = [];
  const asserts: JsonObject[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        presses.push(presses.length + 1);
        return pressAnswers[presses.length - 1] ?? { status: "succeeded", payload: {} };
      }
      if (command.actionType === "web.dom.assert") {
        asserts.push(command.parameters);
        return await assertAnswer();
      }
      return { status: "succeeded", payload: { snapshot: page() } };
    }
  };
  return { gateway, presses, asserts };
}

function page(): JsonObject {
  return {
    url: ITEM,
    title: "Voltbay USB C Hub",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#add", visibleText: "Add to cart" }]
  };
}

function runOn(gateway: WebLlmEvidenceGateway) {
  return { gateway, sessionId: "session.one", request: { ...PROJECT, callId: "add", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: {} } };
}

const held = async (): Promise<WebNodeDispatchResult> => ({ status: "succeeded", payload: {} });
const notHeld = async (): Promise<WebNodeDispatchResult> => ({ status: "failed", error: "the text is not on the page" });

test("with no declared expected state the check answers unknown and asks the page nothing", async () => {
  const s = site([], held);
  for (const parameters of [{ selector: "#add" }, { selector: "#add", expectedState: {} }, { selector: "#add", expectedState: { conditions: [] } }, { selector: "#add", expectedState: "added" }] as JsonObject[]) {
    assert.equal(await webNodeEffectCheck(runOn(s.gateway), parameters)(LOST, 1), "unknown", JSON.stringify(parameters));
  }
  assert.deepEqual(s.asserts, []);
});

test("every declared condition held: landed; one judged and not held: not_landed", async () => {
  assert.equal(await webNodeEffectCheck(runOn(site([], held).gateway), { expectedState: ADDED })(LOST, 1), "landed");
  assert.equal(await webNodeEffectCheck(runOn(site([], notHeld).gateway), { expectedState: ADDED })(LOST, 1), "not_landed");
});

test("a page that never answered the check is unknown, not not_landed", async () => {
  for (const answer of [
    async (): Promise<WebNodeDispatchResult> => ({ status: "cancelled" }),
    async (): Promise<WebNodeDispatchResult> => ({ status: "unknown" }),
    async (): Promise<WebNodeDispatchResult> => { throw new Error("socket closed"); }
  ]) {
    assert.equal(await webNodeEffectCheck(runOn(site([], answer).gateway), { expectedState: ADDED })(LOST, 1), "unknown");
  }
});

test("held conditions beside ones nobody judged are unknown, never landed", async () => {
  let call = 0;
  const half = async (): Promise<WebNodeDispatchResult> => (call++ === 0 ? { status: "succeeded" } : { status: "cancelled" });
  const expectedState = { conditions: [{ kind: "text", expected: "Added to cart" }, { kind: "text", expected: "1 item" }] };
  assert.equal(await webNodeEffectCheck(runOn(site([], half).gateway), { expectedState })(LOST, 1), "unknown");
});

test("mode any: one held is landed; not_landed only when every condition was judged and none held", async () => {
  const expectedState = { mode: "any", conditions: [{ kind: "text", expected: "Added to cart" }, { kind: "text", expected: "1 item" }] };
  let call = 0;
  const secondHeld = async (): Promise<WebNodeDispatchResult> => (call++ === 0 ? { status: "failed" } : { status: "succeeded" });
  assert.equal(await webNodeEffectCheck(runOn(site([], secondHeld).gateway), { expectedState })(LOST, 1), "landed");
  assert.equal(await webNodeEffectCheck(runOn(site([], notHeld).gateway), { expectedState })(LOST, 1), "not_landed");
  let other = 0;
  const oneUnjudged = async (): Promise<WebNodeDispatchResult> => (other++ === 0 ? { status: "failed" } : { status: "cancelled" });
  assert.equal(await webNodeEffectCheck(runOn(site([], oneUnjudged).gateway), { expectedState })(LOST, 1), "unknown");
});

test("under Core's retries: a lost press whose expected state holds is pressed once; one whose state does not is pressed again", async () => {
  const landed = site([LOST], held);
  const once = await webNodeDispatchWithRetries(runOn(landed.gateway), { definitionId: CLICK, effect: "mutate", declared: ["create_new"] },
    { actionType: "web.dom.click", parameters: { selector: "#add", expectedState: ADDED }, metadata: {} }, undefined, webNodeEffectCheck(runOn(landed.gateway), { selector: "#add", expectedState: ADDED }));
  assert.deepEqual(landed.presses, [1]);
  assert.equal(once.lastingAct, "landed");

  const missed = site([LOST], notHeld);
  const again = await webNodeDispatchWithRetries(runOn(missed.gateway), { definitionId: CLICK, effect: "mutate", declared: ["create_new"] },
    { actionType: "web.dom.click", parameters: { selector: "#add", expectedState: ADDED }, metadata: {} }, undefined, webNodeEffectCheck(runOn(missed.gateway), { selector: "#add", expectedState: ADDED }));
  assert.deepEqual(missed.presses, [1, 2]);
  assert.equal(again.result.status, "succeeded");
});

test("exploring: a lost press whose declared expected state holds counts as done and is not pressed again", async () => {
  const s = site([LOST, LOST], held);
  const runtime = createWebAutomationLlmEvidenceRuntime(s.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const add = shownHandle(looked.evidence, "Add to cart");
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "add", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { node: CLICK, parameters: { target: { handle: add }, expectedState: ADDED }, consequences: ["create_new"] } });
  assert.deepEqual(s.presses, [1]);
  assert.equal(s.asserts.length, 1);
  assert.equal(pressed.effectApplied, true);
});

test("replaying: a lost press whose declared expected state does not hold is pressed again", async () => {
  const s = site([LOST], notHeld);
  const runtime = createWebAutomationLlmEvidenceRuntime(s.gateway);
  await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "step", node: CLICK, parameters: { selector: "#add", expectedState: ADDED }, consequences: ["create_new"], from: { location: ITEM } } });
  assert.deepEqual(s.presses, [1, 2]);
});
