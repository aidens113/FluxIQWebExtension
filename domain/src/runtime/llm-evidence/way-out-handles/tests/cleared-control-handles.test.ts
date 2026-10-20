// t470, lane D round 8 (`run-mv5jnc5m-a47c3e59`, t465 defect 2): the clearing closed the site's slow-down notice by
// its OK during a trial, and the model, told to add a step closing it, pressed the only close-like handle it had seen,
// the chat's "Close chat". A trial's pressed way out is now named by a handle of the Flow that resolves to that OK.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationClearedWayOuts } from "../../../../cleared-way-outs";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
import { coreBuildStateStore } from "../../node-run/build-state/tests/core-store";

const PAGE_URL = "https://social.test/requests";
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const closeChat: JsonObject = { tagName: "button", selector: "#chat-close", accessibleName: "Close chat", visibleText: "✕" };
const noticeOk: JsonObject = { tagName: "button", selector: "#slow-down-ok", accessibleName: "OK", visibleText: "OK" };

function runtimeOver(elements: () => JsonObject[], wayOuts = createWebAutomationClearedWayOuts()): { runtime: WebAutomationLlmEvidenceRuntime; wayOuts: typeof wayOuts } {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType !== "web.dom.capture_snapshot"
      ? { status: "succeeded" }
      : { status: "succeeded", payload: { snapshot: { url: PAGE_URL, title: "Requests", interactiveElements: elements() } } }
  }, wayOuts);
  return { runtime, wayOuts };
}

let calls = 0;
async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<Array<{ target: string; name: string }>> {
  const result = await runtime.executeTool({ projectId: "p", flowId: "f", callId: `call.${++calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  return shownPageLines(result.evidence).map((line) => ({ target: line.target, name: line.words ?? "" }));
}

async function candidateSelector(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<string | undefined> {
  const resolved = await runtime.resolvePlanNodeParameters({ projectId: "p", flowId: "f", nodeDefinitionId: CLICK_NODE, parameters: { target: { handle } }, declaredConsequences: [], handleReach: "view_history" });
  return resolved.status === "resolved" ? resolved.parameters.selector as string : undefined;
}

test("a pressed way out is named by a handle of its own, which a candidate step resolves to that control", async () => {
  let elements = [closeChat];
  const { runtime, wayOuts } = runtimeOver(() => elements);
  assert.deepEqual(await look(runtime), [{ target: "t1", name: "Close chat" }]);

  const reference = wayOuts.keep({ url: PAGE_URL, element: noticeOk });
  const named = await runtime.clearedControlHandles!({ projectId: "p", flowId: "f", wayOuts: [reference] });
  assert.deepEqual(named, { [reference]: "t2" });
  assert.equal(await candidateSelector(runtime, "t2"), "#slow-down-ok");
  // The chat's close keeps its own handle and control.
  assert.equal(await candidateSelector(runtime, "t1"), "#chat-close");

  // A later look with the notice up numbers its OK as the trial did.
  elements = [closeChat, noticeOk];
  assert.deepEqual(await look(runtime), [{ target: "t1", name: "Close chat" }, { target: "t2", name: "OK" }]);
});

test("a reference never kept, or a way out the sanitizer cannot describe, is named by no handle", async () => {
  const { runtime, wayOuts } = runtimeOver(() => [closeChat]);
  await look(runtime);
  const unnamed = wayOuts.keep({ url: PAGE_URL, element: { tagName: "button" } });
  const named = await runtime.clearedControlHandles!({ projectId: "p", flowId: "f", wayOuts: ["way-out.unknown", unnamed] });
  assert.deepEqual(named, {});
});

test("another Flow's handles are untouched by naming a way out for this one", async () => {
  const { runtime, wayOuts } = runtimeOver(() => [closeChat]);
  await look(runtime);
  const reference = wayOuts.keep({ url: PAGE_URL, element: noticeOk });
  const named = await runtime.clearedControlHandles!({ projectId: "p", flowId: "other", wayOuts: [reference] });
  assert.deepEqual(named, { [reference]: "t1" });
  assert.equal(await candidateSelector(runtime, "t1"), "#chat-close");
});

// t728: the registry keeps a Flow's ways out in Core's durable build state, so a runtime made after a restart still
// names a way out pressed before it, by a handle that resolves to that control.
test("a way out pressed before a restart is named after it, for its own Flow", async () => {
  const store = coreBuildStateStore();
  const before = createWebAutomationClearedWayOuts(() => store);
  const reference = before.keep({ url: PAGE_URL, element: noticeOk }, { projectId: "p", flowId: "f" });
  await before.settled();

  const { runtime } = runtimeOver(() => [closeChat], createWebAutomationClearedWayOuts(() => store));
  await look(runtime);
  const named = await runtime.clearedControlHandles!({ projectId: "p", flowId: "f", wayOuts: [reference] });
  assert.deepEqual(named, { [reference]: "t2" });
  assert.equal(await candidateSelector(runtime, "t2"), "#slow-down-ok");
});
