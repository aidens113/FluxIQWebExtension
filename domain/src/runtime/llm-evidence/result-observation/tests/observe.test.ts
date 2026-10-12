import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import { observeWebLlmResult } from "..";
import { captureEvidence, selectSession, type WebLlmEvidenceGateway } from "../../capture";

const capture = (gateway: WebLlmEvidenceGateway) => (request: Parameters<typeof observeWebLlmResult>[1]) => captureEvidence(
  gateway, selectSession(gateway.eligibleSessionIds()), { ...request, toolId: "passive", value: {} }, request.signal, undefined, { includeHidden: true });
const request = { projectId: "project", flowId: "flow", callId: "result", permission: automationStudioActionPermissionDenied };

test("publishes hidden ledger state with visibility preserved and no hidden locators or sensitive values", async () => {
  const commands: unknown[] = [];
  const gateway: WebLlmEvidenceGateway = { eligibleSessionIds: () => ["session"], executeAction: async (_session, command) => {
    commands.push(command);
    return { status: "succeeded", payload: { snapshot: { url: "https://example.test/inventory", title: "Inventory", interactiveElements: [
      { tagName: "p", selector: "#status", visibleText: "Visible status: nine available" },
      { tagName: "p", selector: "#ledger", visibleText: "Ledger: eight available", hidden: true },
      { tagName: "input", selector: "#password", inputType: "password", value: "private-marker", hidden: true },
      { tagName: "input", selector: "#form-token", inputType: "hidden", name: "csrf_token", value: "hidden-form-marker", attributes: { type: "hidden", name: "csrf_token", value: "hidden-form-marker" }, hidden: true },
      { tagName: "p", selector: "#credential", visibleText: "Bearer abcdefghijklmnopqrstuvwxyz123456", hidden: true }
    ] } } };
  } };
  const view = await observeWebLlmResult(capture(gateway), request);
  assert.match(String(view.page), /Visible status: nine available/u);
  assert.match(String(view.page), /Ledger: eight available/u);
  assert.match(String(view.page), /"hidden":true/u);
  assert.doesNotMatch(JSON.stringify(view), /#ledger|#password|#form-token|#credential|private-marker|hidden-form-marker|abcdefghijklmnopqrstuvwxyz123456/u);
  const passive = String(view.page).split("PASSIVE NON-RENDERED STATE")[1]!;
  assert.doesNotMatch(passive, /"target"|"selector"|"attributes"|\bt\d+\b/u);
  assert.equal(commands.length, 1);
  assert.deepEqual((commands[0] as { parameters: unknown }).parameters, { includeHidden: true });
});

test("an aborted passive read dispatches nothing and malformed or unreadable captures remain errors", async () => {
  let calls = 0;
  const gateway: WebLlmEvidenceGateway = { eligibleSessionIds: () => ["session"], executeAction: async () => {
    calls++;
    return { status: "failed" };
  } };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(observeWebLlmResult(capture(gateway), { ...request, signal: controller.signal }));
  assert.equal(calls, 0);
  await assert.rejects(observeWebLlmResult(capture(gateway), request));
  assert.equal(calls, 1);
  await assert.rejects(observeWebLlmResult(capture({ ...gateway, executeAction: async () => ({ status: "succeeded", payload: {} }) }), request));
});
