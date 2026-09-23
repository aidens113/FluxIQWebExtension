// The library verb, end to end against a stub gateway: the model names a node,
// the node runs through the same command the built Flow dispatches, and what
// comes back says which step the Flow now contains.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  webRunnableNode,
  webRunnableNodeIds,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "../..";
import { webObservationNodeId } from "../catalog";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

test("the runnable library is derived from the domain's own node definitions", () => {
  const ids = webRunnableNodeIds();
  assert.equal(ids.includes(CLICK), true);
  assert.equal(ids.includes(SNAPSHOT), true);
  assert.equal(webObservationNodeId(), SNAPSHOT);
  // A click acts and belongs in the Flow; the look neither acts nor belongs.
  assert.deepEqual(
    { effect: webRunnableNode(CLICK)?.effect, proposes: webRunnableNode(CLICK)?.proposes },
    { effect: "mutate", proposes: true }
  );
  assert.deepEqual(
    { effect: webRunnableNode(SNAPSHOT)?.effect, proposes: webRunnableNode(SNAPSHOT)?.proposes },
    { effect: "observe", proposes: false }
  );
  assert.equal(webRunnableNode("builtin.logic.and"), undefined);
});

test("the runtime offers detection beside Core's library verb, and says it runs nodes", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub().gateway);
  assert.deepEqual(runtime.tools.map((tool) => tool.toolId), ["web.detect_repeating_structure"]);
  assert.deepEqual(runtime.runsNodes, { initial: { node: SNAPSHOT, parameters: {}, consequences: [] } });
});

test("running a node dispatches the node's own command and records the step it becomes", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  // The look first, so the packet the handle comes from has been shown.
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  assert.equal(looked.effectApplied, false);
  assert.deepEqual(looked.draft, { actionId: SNAPSHOT, effect: "observe", input: { node: SNAPSHOT, parameters: {}, consequences: [] }, ranWith: { node: SNAPSHOT, parameters: {}, consequences: [] }, proposes: false });
  const handle = ((looked.evidence as JsonObject & { elements: Array<{ target: string }> }).elements)[0]!.target;

  stubbed.setTitle("Pressed");
  const pressed = await runtime.executeTool({
    ...PROJECT,
    callId: "call.two",
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: CLICK, parameters: { target: { handle } }, consequences: [] }
  });
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(pressed.effectApplied, true);
  // The step the Flow gains: the node, and the argument the model wrote, so the
  // handle resolves to the same control when the plan is assembled.
  // What the model wrote is shown back to it; what the node ran with -- the
  // real selector and the element identity -- is what the Flow keeps.
  assert.deepEqual(pressed.draft?.input, { node: CLICK, parameters: { target: { handle } }, consequences: [] });
  assert.equal((pressed.draft?.ranWith?.parameters as { selector?: string }).selector, "#go");
  assert.equal(pressed.draft?.proposes, true);
  // The command that went out is the one the finished Flow dispatches, with the
  // selector the handle stood for rather than the handle.
  const click = stubbed.commands.find((command) => command.actionType === "web.dom.click");
  assert.equal(click?.parameters.selector, "#go");
});

test("a node that fails is a result, under its own name, and never a step of the Flow", async () => {
  const stubbed = stub({ failClick: true });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = ((looked.evidence as JsonObject & { elements: Array<{ target: string }> }).elements)[0]!.target;
  const failed = await runtime.executeTool({ ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
  assert.equal(failed.effectApplied, false);
  assert.equal((failed.evidence as JsonObject).ok, false);
  // Its kind still belongs in a Flow; that it did not work is `effectApplied`,
  // and the draft reads the pair, so the step stays on the list the model is
  // shown with `inResult: false` beside it.
  assert.equal(failed.draft?.proposes, true);
  assert.equal(failed.effectApplied, false);
  assert.equal(failed.draft?.actionId, CLICK);
  // The page comes with the refusal, so whatever is in the way has a handle.
  assert.equal(typeof (failed.evidence as JsonObject).page, "object");
});

test("a node this domain cannot run is refused with the ones it can, and nothing is captured", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const refused = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "builtin.logic.and", parameters: {}, consequences: [] } });
  const evidence = refused.evidence as JsonObject & { detail: { reason: string; instead: string[] } };
  assert.equal(evidence.ok, false);
  assert.equal(evidence.detail.reason, "node_not_runnable_here");
  assert.equal(evidence.detail.instead.includes(CLICK), true);
  assert.deepEqual(stubbed.commands, []);
});

test("a declared consequence nobody granted refuses the run, and nothing is dispatched", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const handle = ((looked.evidence as JsonObject & { elements: Array<{ target: string }> }).elements)[0]!.target;
  const before = stubbed.commands.length;
  const refused = await runtime.executeTool({
    ...PROJECT,
    callId: "call.two",
    toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: CLICK, parameters: { target: { handle } }, consequences: ["send_or_publish"] },
    permission: async () => ({ permitted: false, missing: ["send_or_publish"], requestId: "request.one" })
  });
  const evidence = refused.evidence as JsonObject & { code: string; detail: { requestId: string } };
  assert.equal(evidence.code, "permission_required");
  assert.equal(evidence.detail.requestId, "request.one");
  // Only the look the refusal itself took; nothing was clicked.
  assert.equal(stubbed.commands.some((command, index) => index >= before && command.actionType === "web.dom.click"), false);
});

function stub(options: { failClick?: boolean } = {}) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let title = "Fixture";
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { snapshot: page(title) } };
      }
      if (command.actionType === "web.dom.click" && options.failClick) return { status: "failed", error: "the control is gone" };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands, setTitle: (next: string) => { title = next; } };
}

function page(title: string): JsonObject {
  return {
    url: "https://example.test/start",
    title,
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
