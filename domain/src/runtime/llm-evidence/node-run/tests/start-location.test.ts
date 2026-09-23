// A build that begins nowhere: it is told where its Flow starts, and the only
// thing it can do is go there.
//
// The gateway below is the blank tab a browser opens on. The extension refuses
// to read such a page, so every capture fails until something navigates away
// from it -- which is the situation a created Flow meets the first time it runs
// on its own, and the reason a Flow built on a page somebody else opened could
// never reach one.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const START = "https://store.test/catalogue";
const NAVIGATE = "web.output.browser-navigate";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";

test("the free first look says where the Flow starts instead of that the page could not be read", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });

  assert.equal(looked.resultCode, "web.action.rejected.not_at_start_location");
  assert.deepEqual((looked.evidence as JsonObject).detail, { reason: "start_location_not_reached", startLocation: START });
  // Nothing of the page is in it, because there is no page.
  assert.equal((looked.evidence as JsonObject).page, undefined);
});

test("anything but the move that goes there is refused, and never reaches the page", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const pressed = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: CLICK, parameters: { target: { handle: "target.1" } }, consequences: [] }
  });

  assert.equal(pressed.resultCode, "web.action.rejected.not_at_start_location");
  assert.equal(pressed.effectApplied, false);
  // The refusal is decided before anything is dispatched but the capture that
  // discovered there was no page.
  assert.deepEqual(stubbed.commands.map((command) => command.actionType), ["web.dom.capture_snapshot"]);
});

test("the move that goes there runs from nowhere, and is the Flow's own first step", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const went = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: NAVIGATE, parameters: { url: START }, consequences: [] }
  });

  assert.equal(went.resultCode, "web.action.succeeded");
  assert.equal(went.effectApplied, true);
  // This is the whole point: the Flow is assembled from the steps that ran, and
  // the step that reached the page is now one of them.
  assert.equal(went.draft?.proposes, true);
  assert.equal(went.draft?.actionId, NAVIGATE);
  assert.deepEqual(went.draft?.ranWith, { node: NAVIGATE, parameters: { url: START }, consequences: [] });
  // What a replay resets to. The step found no page, so what it records is
  // where it was sent -- which is what putting the Flow back to its beginning
  // means for a Flow that begins by going somewhere (`../replay.ts`).
  assert.deepEqual(went.draft?.replay?.from, { location: START });
  assert.deepEqual(stubbed.commands.map((command) => command.actionType), ["web.dom.capture_snapshot", "web.browser.navigate", "web.dom.capture_snapshot"]);

  // And once it is there, the page is an ordinary page again.
  const looked = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });
  assert.equal(looked.resultCode, "web.inspect.succeeded");
  assert.equal((looked.evidence as JsonObject & { location: string }).location, START);
});

test("from nowhere, the origin an exploration is held to is the start location's", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const elsewhere = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: NAVIGATE, parameters: { url: "https://elsewhere.test/" }, consequences: [] }
  });

  assert.equal(elsewhere.resultCode, "web.action.rejected.cross_origin");
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.browser.navigate"), false);

  // A deeper page of the same site is where the model may legitimately decide
  // the Flow begins, so the anchor is the origin and not the exact address.
  const deeper = await runtime.executeTool({
    ...PROJECT, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: NAVIGATE, parameters: { url: "https://store.test/search?q=earbuds" }, consequences: [] }
  });
  assert.equal(deeper.resultCode, "web.action.succeeded");
});

test("a build that was told no start location is refused exactly as it was before", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  const looked = await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    value: { node: SNAPSHOT, parameters: {}, consequences: [] }
  });

  // "The page could not be read" is the whole truth when there is nowhere to
  // send the model.
  assert.equal(looked.resultCode, "web.action.rejected.page_unreadable");
});

test("the state digest answers nothing from nowhere, rather than failing the step that goes there", async () => {
  const stubbed = blankTab();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);

  assert.equal(await runtime.captureStateDigest({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, phase: "before", startLocation: START }), undefined);

  await runtime.executeTool({
    ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, startLocation: START,
    value: { node: NAVIGATE, parameters: { url: START }, consequences: [] }
  });

  const after = await runtime.captureStateDigest({ ...PROJECT, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, phase: "after", startLocation: START });
  assert.equal(typeof after, "string");
});

/**
 * The blank tab, and the site it can reach.
 *
 * A capture fails until a navigation has succeeded, which is what the extension
 * does on `about:blank`: it refuses every action except a navigation, and judges
 * that one by its destination (`apps/extension/src/runtime/unsupported-page.ts`).
 */
function blankTab() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  let location: string | undefined;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.browser.navigate") {
        location = String(command.parameters.url);
        return { status: "succeeded", payload: { value: "ok" } };
      }
      if (command.actionType === "web.dom.capture_snapshot") {
        return location === undefined
          ? { status: "failed", error: "Browser and extension pages cannot be automated." }
          : { status: "succeeded", payload: { snapshot: page(location) } };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(url: string): JsonObject {
  return {
    url,
    title: "Catalogue",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }]
  };
}
