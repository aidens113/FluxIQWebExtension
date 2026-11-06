// A prompt that came up in the instant a press opened a layer of the Flow's own (t869,
// `../memory.ts`), through the real runtime. The press of its way out answered an interruption, so
// Core makes that step optional and a later run on a page that remembers skips it; the press inside
// the layer the build opened does not, as t193 asks. Generic stubs: no site's words.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const START = "https://example.test/start";

type State = { chooser: boolean; prompt: boolean; chosen: number };

function stub(options: { promptRises: boolean }): WebLlmEvidenceGateway {
  const state: State = { chooser: false, prompt: false, chosen: 0 };
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: pageOf(state) } };
      const selector = command.parameters.selector;
      if (selector === "#open") {
        state.chooser = true;
        state.prompt = options.promptRises;
      }
      if (selector === "#prompt > button") state.prompt = false;
      if (selector === "#chooser > button") {
        state.chooser = false;
        state.chosen += 1;
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
}

function pageOf(state: State): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "button", selector: "#open", visibleText: "Open the chooser" },
    { tagName: "span", selector: "#line", visibleText: `Chosen ${state.chosen}` }
  ];
  const layer = (selector: string, words: string, button: string): void => {
    const at = elements.length;
    elements.push({ tagName: "div", selector, accessibleName: words, frontLayer: true }, { tagName: "button", selector: `${selector} > button`, visibleText: button, parent: at });
  };
  if (state.chooser) layer("#chooser", "A chooser", "Use this one");
  if (state.prompt) layer("#prompt", "A question", "The way out");
  const page: JsonObject = { url: START, title: "Fixture", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
  if (state.prompt) page.evidence = { overlays: { tested: 2, blockedCount: 1, blockers: [{ selector: "#prompt", label: "A question", blocks: 1, blocked: ["#chooser > button"] }] } };
  return page;
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;
const look = (runtime: Runtime) => runtime.executeTool({ projectId: PROJECT.projectId, flowId: PROJECT.flowId, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
const press = (runtime: Runtime, callId: string, handle: string) => runtime.executeTool({ projectId: PROJECT.projectId, flowId: PROJECT.flowId, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
const interrupted = (result: Awaited<ReturnType<Runtime["executeTool"]>>) => result.draft !== undefined && "interruption" in result.draft;

test("the way out of a prompt that rose with a layer the build opened answered an interruption; a press inside that layer did not", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ promptRises: true }));
  const opened = await press(runtime, "call.open", shownHandle((await look(runtime)).evidence, "Open the chooser"));
  assert.equal(interrupted(opened), false);
  const closed = await press(runtime, "call.close", shownHandle(opened.evidence, "The way out"));
  assert.equal(closed.resultCode, "web.action.succeeded", JSON.stringify(closed.evidence).slice(0, 400));
  assert.equal(closed.draft?.interruption, true);
  const chose = await press(runtime, "call.choose", shownHandle(closed.evidence, "Use this one"));
  assert.equal(chose.resultCode, "web.action.succeeded", JSON.stringify(chose.evidence).slice(0, 400));
  assert.equal(interrupted(chose), false);
});

test("with no prompt, the press inside the layer the build opened is still a step of the Flow", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ promptRises: false }));
  const opened = await press(runtime, "call.open", shownHandle((await look(runtime)).evidence, "Open the chooser"));
  const chose = await press(runtime, "call.choose", shownHandle(opened.evidence, "Use this one"));
  assert.equal(interrupted(chose), false);
});

test("a press the page answered as already in its state says so on its evidence", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: pageOf({ chooser: false, prompt: false, chosen: 0 }) } }
      : { status: "succeeded", payload: { skipped: "already_in_state" } }
  });
  const pressed = await press(runtime, "call.press", shownHandle((await look(runtime)).evidence, "Open the chooser"));
  assert.equal((pressed.evidence as JsonObject).skipped, "already_in_state");
});
