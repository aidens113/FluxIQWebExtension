import type { FluxIQ } from "fluxiq";
import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import { bindWebAutomationLlmEvidenceRuntime, type WebAutomationLlmEvidenceRuntime } from "../../..";

test("production binding carries a passive result reader while ordinary snapshots remain rendered-only", async () => {
  let bound: WebAutomationLlmEvidenceRuntime | undefined;
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const fluxiq = { programs: {
    automationStudio: { bindLlmEvidenceRuntime(runtime: WebAutomationLlmEvidenceRuntime) { bound = runtime; } },
    clientGateway: { snapshot: () => ({ sessions: [{ sessionId: "session", status: "ready", clientType: "extension", capabilities: [{ id: "web.actions", actionTypes: ["web.dom.capture_snapshot"] }] }] }) },
    automationStudioClientGateway: { executeAction: async (_session: string, command: { actionType: string; parameters: JsonObject }) => {
      commands.push(command);
      return { status: "succeeded", payload: { snapshot: { url: "https://example.test/inventory", title: "Inventory", interactiveElements: [
        { tagName: "p", selector: "#status", visibleText: "Visible status: nine available" },
        ...(command.parameters.includeHidden ? [{ tagName: "p", selector: "#ledger", visibleText: "Ledger: eight available", hidden: true }] : [])
      ] } } };
    } }
  } };
  bindWebAutomationLlmEvidenceRuntime(fluxiq as unknown as FluxIQ);
  assert.ok(bound);
  const result = bound;
  assert.equal(typeof result.observeResult, "function", "bound runtime must carry passive result observation");
  const view = await result.observeResult!({ projectId: "project", flowId: "flow", callId: "result", permission: automationStudioActionPermissionDenied });
  assert.match(String(view?.page), /Ledger: eight available/u);
  assert.deepEqual(commands.map(x => [x.actionType, x.parameters]), [["web.dom.capture_snapshot", { includeHidden: true }]]);
  const ordinary = await bound.executeTool({ projectId: "project", flowId: "flow", callId: "ordinary", toolId: "core.run_node", value: bound.runsNodes!.initial! });
  assert.doesNotMatch(String((ordinary.evidence as JsonObject).page), /Ledger/u);
  assert.deepEqual(commands[1]?.parameters, {});
  const refused = await bound.executeTool({ projectId: "project", flowId: "flow", callId: "unissued", toolId: "core.run_node", value: { node: "web.output.dom-click", parameters: { target: { handle: "t2" } }, consequences: [] } });
  assert.equal(refused.effectApplied, false, "passive hidden state issued no executable handle");
  assert.ok(commands.every(command => command.actionType === "web.dom.capture_snapshot"));
});
