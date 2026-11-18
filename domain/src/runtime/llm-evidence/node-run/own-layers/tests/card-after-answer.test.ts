// A fresh card coinciding with an interruption answer must not become required cleanup.
// A required opener still owns the same card. Synthetic pages, through the real runtime.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const START = "https://example.test/start";
type State = { notice: boolean; card: boolean; finished: number };

function stub(options: { notice: boolean; tied: boolean }): WebLlmEvidenceGateway {
  const state: State = { notice: options.notice, card: false, finished: 0 };
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: pageOf(state, options.tied) } };
      const selector = command.parameters.selector;
      if (selector === "#open" || selector === "#notice > button") {
        state.notice = false;
        state.card = true;
      }
      if (selector === "#card > button") {
        state.card = false;
        state.finished += 1;
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
}

function pageOf(state: State, tied: boolean): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "button", selector: "#open", visibleText: "Open options" },
    { tagName: "span", selector: "#finished", visibleText: `Finished ${state.finished}` }
  ];
  const layer = (selector: string, words: string, button: string, attributes: JsonObject): void => {
    const at = elements.length;
    elements.push(
      { tagName: "div", selector, accessibleName: words, frontLayer: true, attributes: { id: selector.slice(1) } },
      { tagName: "button", selector: `${selector} > button`, visibleText: button, parent: at, attributes }
    );
  };
  if (state.notice) layer("#notice", "A notice", "Got it", tied ? { "aria-controls": "card" } : {});
  if (state.card) layer("#card", "Another card", "Finish selection", {});
  return { url: START, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;
type Result = Awaited<ReturnType<Runtime["executeTool"]>>;
const look = (runtime: Runtime) => runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
const press = (runtime: Runtime, callId: string, handle: string) => runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
const succeeded = (result: Result) => assert.equal(result.resultCode, "web.action.succeeded");

for (const tied of [false, true]) {
  test(`${tied ? "A tied" : "An untied"} fresh card after an interruption answer remains an interruption`, async () => {
    const runtime = createWebAutomationLlmEvidenceRuntime(stub({ notice: true, tied }));
    const answered = await press(runtime, "call.answer", shownHandle((await look(runtime)).evidence, "Got it"));
    succeeded(answered);
    assert.equal(answered.draft?.interruption, true);
    const finished = await press(runtime, "call.finish", shownHandle(answered.evidence, "Finish selection"));
    succeeded(finished);
    assert.equal(finished.draft?.interruption, true);
  });
}

test("the same card opened by a required action keeps its selection required", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ notice: false, tied: false }));
  const opened = await press(runtime, "call.open", shownHandle((await look(runtime)).evidence, "Open options"));
  succeeded(opened);
  assert.equal(opened.draft?.interruption, undefined);
  const finished = await press(runtime, "call.finish", shownHandle(opened.evidence, "Finish selection"));
  succeeded(finished);
  assert.equal(finished.draft?.interruption, undefined);
});
