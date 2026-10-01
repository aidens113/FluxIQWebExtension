import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_FIND_ON_PAGE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.find", flowId: "flow.find" } as const;

/** A page whose account menu is closed: its items are listed only when a capture asks for hidden elements. */
function site(): { gateway: WebLlmEvidenceGateway; captures: JsonObject[]; clicks: string[] } {
  const captures: JsonObject[] = [];
  const clicks: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.click") {
        clicks.push(String(command.parameters.selector));
        return { status: "succeeded" };
      }
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      captures.push(command.parameters);
      const visible = [
        { tagName: "button", selector: "#account", accessibleName: "Account" },
        { tagName: "a", selector: "#home", accessibleName: "Home", attributes: { href: "/home" } }
      ];
      const hidden = [{ tagName: "a", selector: "#orders", accessibleName: "Your orders", attributes: { href: "/orders", "data-testid": "menu-orders" }, hidden: true }];
      const interactiveElements = command.parameters.includeHidden === true ? [...visible, ...hidden] : visible;
      return { status: "succeeded", payload: { snapshot: { url: "https://shop.test/home", title: "Shop", interactiveElements } } };
    }
  };
  return { gateway, captures, clicks };
}

test("find_on_page is offered with the view described, searches a capture that includes hidden elements, and answers web-llm-find.v1", async () => {
  const { gateway, captures } = site();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const tool = runtime.tools.find((candidate) => candidate.toolId === WEB_LLM_FIND_ON_PAGE_TOOL_ID);
  assert.ok(tool, "the tool is registered");
  assert.equal(tool.effect, "observe");
  assert.ok(tool.description.length <= 2_000, "within Core's description bound");
  assert.match(tool.description, /handle \(tN/u);

  const found = await runtime.executeTool({ ...PROJECT, callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "menu-orders" } });
  assert.deepEqual(captures, [{ includeHidden: true }]);
  assert.equal(found.resultCode, "web.inspect.succeeded");
  assert.equal(found.effectApplied, false);
  const evidence = found.evidence as { schemaVersion: string; location: string; found: string };
  assert.equal(evidence.schemaVersion, "web-llm-find.v1");
  assert.equal(evidence.location, "https://shop.test/home");
  assert.deepEqual(evidence.found.split("\n"), ["1 match for \"menu-orders\"", "t3 link \"Your orders\" (data-testid=\"menu-orders\") not rendered"]);
  assert.equal(JSON.stringify(found.evidence).includes("#orders"), false, "no selector reaches the model");
});

test("a handle a search printed is one a press binds, and a hidden element never takes a visible one's handle", async () => {
  const { gateway, clicks } = site();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  assert.match(String((looked.evidence as { page: string }).page), /^t1 button "Account"$/mu);

  const found = await runtime.executeTool({ ...PROJECT, callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "account" } });
  assert.match((found.evidence as { found: string }).found, /^t1 button "Account" on screen$/mu);
  const orders = await runtime.executeTool({ ...PROJECT, callId: "call.find.orders", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "your orders" } });
  const handle = /^(t\d+) link "Your orders"/mu.exec((orders.evidence as { found: string }).found)?.[1];
  assert.equal(handle, "t3");

  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "t1" } }, consequences: [] } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence));
  assert.deepEqual(clicks, ["#account"]);
});

test("a search with bad input is refused with the domain's input reasons, and captures nothing", async () => {
  const { gateway, captures } = site();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const refused = await runtime.executeTool({ ...PROJECT, callId: "call.find.bad", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "x", selector: "#orders" } });
  assert.equal(refused.resultCode, "web.action.rejected.invalid_input");
  assert.equal((refused.evidence as { detail: { reason: string } }).detail.reason, "unexpected_input_keys");
  assert.deepEqual(captures, []);
});
