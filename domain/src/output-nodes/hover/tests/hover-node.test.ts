// The hover node, `web.dom.hover` (t903, F5): declared as an element step that changes nothing
// lasting, described for a model within Core's bounds, and run by the library verb as the
// command the page's hover verb reads.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES } from "../../../actions/types";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID } from "../../../runtime/llm-evidence";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../../definitions";
import { shownHandle } from "../../../runtime/llm-evidence/page-view/tests/shown-page-lines";

const HOVER = webAutomationOutputNodeId("web.dom.hover");

test("hover is an action type and a node of the library, targeting one element and declaring nothing lasting", () => {
  assert.equal(WEB_AUTOMATION_ACTION_TYPES.includes("web.dom.hover"), true);
  const node = webAutomationOutputNodeDefinitions.find((definition) => definition.id === HOVER);
  assert.ok(node, HOVER);
  assert.equal(node.metadata?.elementTarget, true);
  assert.equal(node.metadata?.consequenceDeclaration, "not_required");
  // Core keeps 240 characters of a node description, and its first sentence within 80.
  assert.equal(node.description.length <= 240, true, `${node.description.length} characters`);
  const first = node.description.slice(0, node.description.indexOf(".") + 1);
  assert.equal(first.length > 0 && first.length <= 80, true, first);
  assert.match(node.description, /handle in target/u);
  for (const tag of ["hover", "menu"]) assert.equal(node.tags?.includes(tag), true, tag);
});

test("running the hover node dispatches web.dom.hover on the element its handle names", async () => {
  const sent: Array<{ actionType: string; parameters: JsonObject }> = [];
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      sent.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: "https://shop.test/", title: "Shop", interactiveElements: [{ tagName: "span", selector: "#account", visibleText: "Welcome back Mara" }] } } };
    }
  });
  const scope = { projectId: "project.one", flowId: "flow.one" };
  const looked = await runtime.executeTool({ ...scope, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const handle = shownHandle(looked.evidence, "Welcome back Mara");
  const hovered = await runtime.executeTool({ ...scope, callId: "call.hover", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true as const }), value: { node: HOVER, parameters: { target: { handle } }, consequences: [] } });
  assert.equal(hovered.resultCode, "web.action.succeeded", JSON.stringify(hovered.evidence).slice(0, 400));
  const dispatched = sent.find((entry) => entry.actionType === "web.dom.hover");
  assert.equal(dispatched?.parameters.selector, "#account");
});
