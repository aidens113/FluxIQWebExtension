// A library call's declaration says where its control sits (Core t475): the
// opaque token of the record -- here, a request's row -- so Core can refuse an
// undo aimed at another row's Confirm before anything is pressed. Lane D round
// 10 (`run-mv5tusge-1400ddf7`) aimed an undo at Tom Becker's Confirm, a row the
// build never touched.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionDeclaration } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webControlSpotToken } from "..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const SEP = String.fromCharCode(31);

/** Two request rows, each with its own Confirm button. */
function requests(): JsonObject {
  const row = (name: string, y: number) => [
    { tagName: "a", selector: `#name-${name}`, visibleText: name, bounds: { x: 0, y, width: 100, height: 20 }, context: { record: { text: name } } },
    { tagName: "button", selector: `#confirm-${name}`, visibleText: "Confirm", bounds: { x: 200, y, width: 80, height: 20 }, context: { record: { text: name } } }
  ];
  return { url: "https://example.test/requests", title: "Requests", viewport: { width: 400, height: 400, scrollX: 0, scrollY: 0 }, interactiveElements: [...row("Tom Becker", 0), ...row("Amara Osei", 40)] };
}

test("a press declares the opaque token of the row its control sits in: each row its own, and none of its words", async () => {
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => command.actionType === "web.dom.capture_snapshot" ? { status: "succeeded", payload: { snapshot: requests() } } : { status: "succeeded", payload: { value: "ok" } }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const confirms = shownPageLines(looked.evidence).filter((line) => line.words === "Confirm");
  assert.equal(confirms.length, 2);
  const declared: AutomationStudioActionDeclaration[] = [];
  for (const [n, line] of confirms.entries()) {
    await runtime.executeTool({
      ...PROJECT, callId: `call.press.${n}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: "web.output.dom-click", parameters: { target: { handle: line.target } }, consequences: ["modify_existing"] },
      permission: async (declaration) => {
        declared.push(declaration);
        return { permitted: true };
      }
    });
  }
  const items = declared.map((declaration) => declaration.control.item);
  assert.deepEqual(new Set(items), new Set([webControlSpotToken("item", `text${SEP}Tom Becker`), webControlSpotToken("item", `text${SEP}Amara Osei`)]));
  assert.ok(!JSON.stringify(declared.map((declaration) => declaration.control.item)).includes("Amara"));
});
