import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID, WEB_LLM_FIND_ON_PAGE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import type { WebLlmPageEvidence } from "../../sanitize";
import { RecoverableToolRejection } from "../../tool-rejection";
import { webLlmDescribeElement } from "../description";

const VIEWPORT = { width: 1280, height: 720, scrollX: 0, scrollY: 0 };

function page(): WebLlmPageEvidence {
  return {
    schemaVersion: "web-llm-evidence.v2",
    trust: "untrusted-page-evidence",
    location: "https://shop.test/s",
    truncated: false,
    viewport: VIEWPORT,
    elements: [
      { target: "t1", tag: "select", name: "Search in", attributes: [["id", "searchDropdownBox"], ["data-testid", "scope"]], box: { x: 10, y: 20, width: 120, height: 30 }, onViewport: true, selectedValue: "All", options: [{ value: "all", label: "All" }, { value: "tv", label: "Electronics" }], landmark: "search" },
      { target: "t2", tag: "a", name: "Your orders", href: "https://shop.test/orders", hidden: true },
      { target: "t3", tag: "span" }
    ]
  };
}

test("describes one element whole: its line, every attribute, its box and where, and every other field", () => {
  const described = webLlmDescribeElement(page(), "t1");
  assert.equal(described.schemaVersion, "web-llm-describe.v1");
  assert.equal(described.location, "https://shop.test/s");
  assert.deepEqual(described.element.split("\n"), [
    "t1 <select> select \"Search in\"",
    "attributes: id=\"searchDropdownBox\" data-testid=\"scope\"",
    "box: x=10 y=20 120x30, on screen",
    "context: name=\"Search in\" onViewport=true selectedValue=\"All\" options=[{\"value\":\"all\",\"label\":\"All\"},{\"value\":\"tv\",\"label\":\"Electronics\"}] landmark=\"search\""
  ]);
});

test("a hidden element a search found, and one with nothing to say, are described as they are", () => {
  assert.deepEqual(webLlmDescribeElement(page(), "t2").element.split("\n").slice(0, 3), ["t2 <a> link \"Your orders\"", "attributes: none", "box: none, not rendered"]);
  assert.deepEqual(webLlmDescribeElement(page(), "target.3").element.split("\n"), ["t3 <span>", "attributes: none", "box: none, on screen", "context: none"]);
});

test("a handle not on the page is refused as unobserved", () => {
  assert.throws(() => webLlmDescribeElement(page(), "t9"), (error) => error instanceof RecoverableToolRejection && error.code === "target_unobserved" && error.detail?.reason === "handle_not_in_packet");
});

/** A page whose account menu is closed: its items are listed only when a capture asks for hidden elements. */
function site(): { gateway: WebLlmEvidenceGateway; captures: JsonObject[] } {
  const captures: JsonObject[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      captures.push(command.parameters);
      const visible = [{ tagName: "button", selector: "#account", accessibleName: "Account", attributes: { "aria-expanded": "false" } }];
      const hidden = [{ tagName: "a", selector: "#orders", accessibleName: "Your orders", attributes: { href: "/orders", "data-testid": "menu-orders" }, hidden: true }];
      return { status: "succeeded", payload: { snapshot: { url: "https://shop.test/home", title: "Shop", interactiveElements: command.parameters.includeHidden === true ? [...visible, ...hidden] : visible } } };
    }
  };
  return { gateway, captures };
}

test("describe_element is offered, captures with hidden elements, and describes a handle a search printed", async () => {
  const { gateway, captures } = site();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const tool = runtime.tools.find((candidate) => candidate.toolId === WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID);
  assert.ok(tool && tool.effect === "observe" && tool.description.length <= 2_000);
  const found = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.find", toolId: WEB_LLM_FIND_ON_PAGE_TOOL_ID, value: { query: "orders" } });
  const handle = /^(t\d+) link "Your orders"/mu.exec((found.evidence as { found: string }).found)?.[1];
  assert.equal(handle, "t2");
  const described = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.describe", toolId: WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID, value: { target: handle } });
  assert.equal(described.resultCode, "web.inspect.succeeded");
  const element = (described.evidence as { schemaVersion: string; element: string }).element;
  assert.match(element, /^t2 <a> link "Your orders"$/mu);
  assert.match(element, /^attributes: href="https:\/\/shop\.test\/orders" data-testid="menu-orders"$/mu);
  assert.deepEqual(captures, [{ includeHidden: true }, { includeHidden: true }]);
  assert.equal(JSON.stringify(described.evidence).includes("#orders"), false, "no selector reaches the model");

  const refused = await runtime.executeTool({ projectId: "p", flowId: "f", callId: "call.describe.bad", toolId: WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID, value: { target: "#orders" } });
  assert.equal((refused.evidence as { detail: { reason: string } }).detail.reason, "malformed_handle");
});
