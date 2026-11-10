// A cover that rose on its own as a field was typed in, through the real runtime (t885,
// `../opened-by.ts`; the shape of `run-mwa9oytn-d866da84`). The press of its way out answered an
// interruption, so Core makes that step optional and a later run on a page that remembers the
// answer passes it over; a press inside a suggestion list the typing opened does not. Generic
// stubs: no site's words.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const TYPE = "web.output.dom-type";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const START = "https://example.test/start";

/** What typing raises: a card far from the field (on its own), or a list hanging from the field's edge (the typing's). */
type Rises = "card" | "list";
type State = { value: string; card: boolean; list: boolean };

function stub(rises: Rises): WebLlmEvidenceGateway {
  const state: State = { value: "", card: false, list: false };
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: pageOf(state) } };
      const selector = command.parameters.selector;
      if (command.actionType === "web.dom.type" && selector === "#field") {
        state.value = String(command.parameters.text ?? "");
        if (rises === "card") state.card = true;
        else state.list = true;
      }
      if (selector === "#card > button") state.card = false;
      if (selector === "#list > button") {
        state.list = false;
        state.value = "A suggestion";
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
}

const bounds = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

function pageOf(state: State): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "input", selector: "#field", accessibleName: "Highest", value: state.value, hasValue: state.value !== "", documentBounds: bounds(40, 600, 120, 30) },
    { tagName: "button", selector: "#apply", visibleText: "Apply", documentBounds: bounds(170, 600, 40, 30) }
  ];
  const layer = (selector: string, words: string, button: string, box: JsonObject, buttonBox: JsonObject): void => {
    const at = elements.length;
    elements.push({ tagName: "div", selector, accessibleName: words, frontLayer: true, documentBounds: box }, { tagName: "button", selector: `${selector} > button`, visibleText: button, parent: at, documentBounds: buttonBox });
  };
  if (state.card) layer("#card", "Hear about deals", "Later", bounds(24, 186, 340, 130), bounds(40, 270, 60, 30));
  if (state.list) layer("#list", "Suggestions", "A suggestion", bounds(40, 632, 160, 90), bounds(40, 640, 160, 24));
  return { url: START, title: "Fixture", viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;
type Result = Awaited<ReturnType<Runtime["executeTool"]>>;
const call = (runtime: Runtime, callId: string, node: string, parameters: JsonObject) => runtime.executeTool({ projectId: PROJECT.projectId, flowId: PROJECT.flowId, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
const look = (runtime: Runtime) => call(runtime, "call.look", SNAPSHOT, {});
const type = (runtime: Runtime, handle: string) => call(runtime, "call.type", TYPE, { target: { handle }, text: "10" });
const press = (runtime: Runtime, callId: string, handle: string) => call(runtime, callId, CLICK, { target: { handle } });
const succeeded = (result: Result) => assert.equal(result.resultCode, "web.action.succeeded", JSON.stringify(result.evidence).slice(0, 400));

test("the way out of a cover that rose on its own as a field was typed in answered an interruption", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub("card"));
  const typed = await type(runtime, shownHandle((await look(runtime)).evidence, "Highest"));
  succeeded(typed);
  const later = await press(runtime, "call.later", shownHandle(typed.evidence, "Later"));
  succeeded(later);
  assert.equal(later.draft?.interruption, true);
});

test("a press inside a suggestion list the typing opened is a step of the Flow, not an answer to an interruption", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub("list"));
  const typed = await type(runtime, shownHandle((await look(runtime)).evidence, "Highest"));
  succeeded(typed);
  const chose = await press(runtime, "call.choose", shownHandle(typed.evidence, "A suggestion"));
  succeeded(chose);
  assert.equal(chose.draft !== undefined && "interruption" in chose.draft, false);
});
