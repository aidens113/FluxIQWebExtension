import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActionPermissionDenied } from "fluxiq/automation";
import { observeWebLlmResult } from "..";
import { captureEvidence, selectSession, type WebLlmEvidenceGateway } from "../../capture";
import type { JsonObject } from "fluxiq/core";
import { webLlmShownPageText } from "../../page-view";

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
  assert.match(String(webLlmShownPageText(view)), /Visible status: nine available/u);
  assert.match(String(webLlmShownPageText(view)), /Ledger: eight available/u);
  assert.match(String(webLlmShownPageText(view)), /"hidden":true/u);
  assert.doesNotMatch(JSON.stringify(view), /#ledger|#password|#form-token|#credential|private-marker|hidden-form-marker|abcdefghijklmnopqrstuvwxyz123456/u);
  const passive = String(webLlmShownPageText(view)).split("PASSIVE NON-RENDERED STATE")[1]!;
  assert.doesNotMatch(passive, /"target"|"selector"|"attributes"|\bt\d+\b/u);
  assert.equal(commands.length, 1);
  assert.deepEqual((commands[0] as { parameters: unknown }).parameters, { includeHidden: true });
  const semantic = view.judgeState as JsonObject;
  assert.equal(semantic.version, 1);
  assert.deepEqual(semantic.notices, [], "hidden plain page text stays in the private page, not in semantic notices");
  assert.doesNotMatch(JSON.stringify(semantic), /"page"|"target"|"selector"|"attributes"|"box"|private-marker|hidden-form-marker/u);
});

test("the same passive capture supplies full named values, selection, marks and notices without page text or geometry", async () => {
  let calls = 0;
  const gateway: WebLlmEvidenceGateway = { eligibleSessionIds: () => ["session"], executeAction: async () => {
    calls += 1;
    return { status: "succeeded", payload: { snapshot: { url: "https://example.test/settings", title: "Settings", interactiveElements: [
      { tagName: "input", selector: "#name", accessibleName: "Display name", value: "A complete original value", attributes: { "aria-label": "Display name" }, box: { x: 1, y: 2, width: 90, height: 20 } },
      { tagName: "input", selector: "#choice", accessibleName: "Updates", inputType: "checkbox", checked: false, attributes: { "aria-label": "Updates", type: "checkbox" } },
      { tagName: "select", selector: "#region", accessibleName: "Region", selectedValue: "north", options: [{ value: "north", label: "North" }, { value: "south", label: "South" }], attributes: { "aria-label": "Region" } },
      { tagName: "button", selector: "#saved", accessibleName: "Saved", attributes: { "aria-label": "Saved", "aria-pressed": "true", "data-private-layout": "RAW_ATTRIBUTE_SENTINEL" } },
      { tagName: "p", selector: "#notice", role: "status", visibleText: "Settings saved successfully" },
      { tagName: "div", selector: "#unrelated", visibleText: "RAW_PAGE_SENTINEL" }
    ] } } };
  } };
  const view = await observeWebLlmResult(capture(gateway), request);
  const state = view.judgeState as JsonObject;
  const serialized = JSON.stringify(state);
  assert.match(serialized, /A complete original value/u);
  assert.match(serialized, /"checked":false/u);
  assert.match(serialized, /north/u);
  assert.match(serialized, /aria-pressed/u);
  assert.match(serialized, /Settings saved successfully/u);
  assert.doesNotMatch(serialized, /RAW_PAGE_SENTINEL|RAW_ATTRIBUTE_SENTINEL|#name|#notice|"page"|"box"|"target"|"attributes"/u);
  assert.equal(calls, 1);
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
