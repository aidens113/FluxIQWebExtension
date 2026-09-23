import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webActionFailureRejectionCode } from "../action-failure";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  type WebLlmEvidenceGateway
} from "..";

// An action the page did not let happen is a refusal the model can act on,
// never a thrown error that ends the exploration. Live on 2026-09-21 the
// professional-network site's Flow creation died on its first press, because a
// promotion had opened over the page after it loaded.

const BASE = { projectId: "project.one", flowId: "flow.one", maxEvidenceBytes: 8_000 } as const;
const PRIVATE = "div#ember789 covers the target: Download the Guildline app";
const DIALOG_BOX = { x: 400, y: 200, width: 400, height: 300 };

type Click = { status: string; failure?: JsonObject; error?: string };

/** A feed whose app prompt can open over it, appended after forty-four other controls. */
function promptPage() {
  const state = { prompt: false, clicks: [] as string[], captureFails: false };
  const feed = Array.from({ length: 44 }, (_, index) => ({
    tagName: "button", selector: `#post-${index + 1}`, visibleText: `Post ${index + 1}`, attributes: { type: "button" },
    bounds: { x: 20, y: 20 + index * 30, width: 100, height: 20 }
  }));
  const snapshot = (): JsonObject => {
    const page: JsonObject = {
      url: "https://network.test/feed",
      title: "Feed",
      interactiveElements: [
        { tagName: "button", selector: "#open-search", visibleText: "Search people", attributes: { type: "button" }, bounds: { x: 20, y: 5, width: 100, height: 10 } },
        ...feed,
        ...(state.prompt ? [{ tagName: "button", selector: "#not-now", visibleText: "Not now", attributes: { type: "button" }, bounds: { x: 450, y: 400, width: 80, height: 30 } }] : [])
      ]
    };
    if (state.prompt) page.evidence = { dialogs: { open: [{ selector: "#prompt", role: "dialog", modal: true, native: false, bounds: DIALOG_BOX }], modal: true } };
    return page;
  };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        return state.captureFails ? { status: "failed", error: PRIVATE } : { status: "succeeded", payload: { snapshot: snapshot() } };
      }
      const selector = String(command.parameters.selector);
      state.clicks.push(selector);
      if (selector === "#not-now") {
        state.prompt = false;
        return { status: "succeeded" };
      }
      if (state.prompt) {
        const blocked: Click = { status: "failed", error: `Action blocked: ${PRIVATE}`, failure: { category: "unexpected_state", code: WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG, retryable: false, stage: "execution", actual: `covered: ${PRIVATE}` } };
        return blocked;
      }
      return { status: "succeeded" };
    }
  };
  return { state, gateway };
}

function handleFor(evidence: unknown, text: string): string {
  const element = (evidence as { elements: Array<{ target: string; text?: string }> }).elements.find((candidate) => candidate.text === text);
  assert.ok(element, `${text} is in the packet`);
  return element.target;
}

test("a press behind a modal is refused blocked_by_dialog with the page, whose dialog control can be pressed next", async () => {
  const { state, gateway } = promptPage();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const inspected = await runtime.executeTool({ ...BASE, callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const search = handleFor(inspected.evidence, "Search people");
  state.prompt = true;

  const refused = await runtime.executeTool({ ...BASE, callId: "call.press.1", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: search } }, consequences: [] } });
  assert.equal(refused.resultCode, "web.action.rejected.blocked_by_dialog");
  assert.equal(refused.effectApplied, false);
  const refusal = refused.evidence as { schemaVersion: string; ok: boolean; code: string; page: { elements: unknown[]; dialogs?: unknown } };
  assert.deepEqual([refusal.schemaVersion, refusal.ok, refusal.code], ["web-llm-tool-result.v1", false, "blocked_by_dialog"]);
  // The dialog's own control leads the packet although the capture listed it last, past the element bound.
  assert.equal((refusal.page.elements[0] as { text?: string }).text, "Not now");
  assert.deepEqual(refusal.page.dialogs, [{ role: "dialog", modal: true }]);
  assert.equal(JSON.stringify(refused).includes("ember789"), false);
  assert.equal(JSON.stringify(refused).includes("Download"), false);

  const dismissed = await runtime.executeTool({ ...BASE, callId: "call.press.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handleFor(refusal.page, "Not now") } }, consequences: [] } });
  assert.equal(dismissed.resultCode, "web.action.succeeded");
  const pressed = await runtime.executeTool({ ...BASE, callId: "call.press.3", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handleFor(dismissed.evidence, "Search people") } }, consequences: [] } });
  assert.notEqual(pressed.resultCode, "web.action.rejected.blocked_by_dialog");
  assert.deepEqual(state.clicks, ["#open-search", "#not-now", "#open-search"]);
});

test("a refusal and the page inside it stay within the call's budget", async () => {
  const { state, gateway } = promptPage();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const inspected = await runtime.executeTool({ ...BASE, maxEvidenceBytes: 1_500, callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  state.prompt = true;
  const refused = await runtime.executeTool({ ...BASE, maxEvidenceBytes: 1_500, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handleFor(inspected.evidence, "Search people") } }, consequences: [] } });
  assert.equal(refused.resultCode, "web.action.rejected.blocked_by_dialog");
  assert.ok(new TextEncoder().encode(JSON.stringify(refused.evidence)).byteLength <= 1_500);
  assert.equal(((refused.evidence as { page: { elements: Array<{ text?: string }> } }).page.elements[0])?.text, "Not now");
});

test("a refusal whose page cannot be captured again is the bare code", async () => {
  const { state, gateway } = promptPage();
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: gateway.eligibleSessionIds,
    executeAction: async (sessionId, command) => {
      const result = await gateway.executeAction(sessionId, command);
      if (command.actionType !== "web.dom.capture_snapshot") state.captureFails = true;
      return result;
    }
  });
  const inspected = await runtime.executeTool({ ...BASE, callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  state.prompt = true;
  const refused = await runtime.executeTool({ ...BASE, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handleFor(inspected.evidence, "Search people") } }, consequences: [] } });
  assert.deepEqual(refused.evidence, { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "blocked_by_dialog" });
  assert.equal(refused.effectApplied, false);
  assert.equal(refused.resultCode, "web.action.rejected.blocked_by_dialog");
  // The step is recorded under the node's own name and never reaches the Flow.
  assert.equal(refused.draft?.actionId, "web.output.dom-click");
  assert.equal(refused.effectApplied, false);
});

test("a page that cannot be captured, or cannot fit what is left of the budget, is refused rather than thrown", async () => {
  const { state, gateway } = promptPage();
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const tiny = await runtime.executeTool({ ...BASE, maxEvidenceBytes: 40, callId: "call.tiny", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  assert.deepEqual(tiny.evidence, { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "evidence_budget_exhausted" });
  assert.equal(tiny.resultCode, "web.action.rejected.evidence_budget_exhausted");
  state.captureFails = true;
  const unreadable = await runtime.executeTool({ ...BASE, callId: "call.unreadable", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  assert.deepEqual(unreadable.evidence, { schemaVersion: "web-llm-tool-result.v1", ok: false, code: "page_unreadable" });
  assert.equal(JSON.stringify(unreadable).includes("ember789"), false);
});

test("a navigation that landed somewhere else is refused page_changed, with the page it left behind", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: "https://network.test/feed", interactiveElements: [{ tagName: "a", selector: "#home", visibleText: "Home" }] } } }
      : { status: "failed", error: PRIVATE, failure: { category: "state_mismatch", code: WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED, retryable: false, stage: "verification", actual: PRIVATE } }
  });
  const refused = await runtime.executeTool({ ...BASE, callId: "call.navigate", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.browser-navigate", parameters: { url: "https://network.test/search" }, consequences: [] } });
  assert.equal(refused.resultCode, "web.action.rejected.page_changed");
  assert.equal((refused.evidence as { page: { location: string } }).page.location, "https://network.test/feed");
  assert.equal(JSON.stringify(refused).includes("ember789"), false);
});

test("cancellation during the refusal's look at the page still ends the call", async () => {
  const { state, gateway } = promptPage();
  const controller = new AbortController();
  let clicked = false;
  const runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: gateway.eligibleSessionIds,
    executeAction: async (sessionId, command) => {
      // The look after the refused click is where the run is cancelled.
      if (clicked && command.actionType === "web.dom.capture_snapshot") controller.abort(new Error("cancelled by the run"));
      if (command.actionType !== "web.dom.capture_snapshot") clicked = true;
      return await gateway.executeAction(sessionId, command);
    }
  });
  const inspected = await runtime.executeTool({ ...BASE, callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  state.prompt = true;
  await assert.rejects(runtime.executeTool({ ...BASE, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: handleFor(inspected.evidence, "Search people") } }, consequences: [] }, signal: controller.signal }), /cancelled by the run/u);
});

test("a failed action's refusal code is read from the client's closed code, never its words", () => {
  const codes = WEB_AUTOMATION_FAILURE_CODES;
  const cases: Array<[Parameters<typeof webActionFailureRejectionCode>[0], string]> = [
    [{ status: "failed", failure: { code: codes.BLOCKED_BY_DIALOG, actual: "covered: x" } }, "blocked_by_dialog"],
    [{ status: "failed", failure: { code: codes.BLOCKED_BY_DIALOG, actual: "hidden: x" } }, "blocked_by_dialog"],
    // A challenge only a person may answer is never offered to the model as a
    // dialog to close, whatever the refusal's words say.
    [{ status: "failed", failure: { code: codes.USER_INTERVENTION_REQUIRED, actual: "covered: x" } }, "needs_person"],
    [{ status: "failed", failure: { code: codes.USER_INTERVENTION_REQUIRED } }, "needs_person"],
    [{ status: "failed", failure: { code: codes.AUTH_REQUIRED } }, "needs_person"],
    [{ status: "failed", failure: { code: codes.ACTION_REJECTED, actual: "covered: the cookie banner" } }, "target_covered"],
    [{ status: "failed", failure: { code: codes.ACTION_REJECTED, actual: "disabled: Save" } }, "target_not_actionable"],
    [{ status: "failed", failure: { code: codes.ACTION_REJECTED, actual: "the words covered: later" } }, "target_not_actionable"],
    [{ status: "failed", failure: { code: codes.TARGET_NOT_FOUND } }, "target_not_found"],
    [{ status: "failed", failure: { code: codes.TARGET_AMBIGUOUS } }, "target_not_found"],
    [{ status: "failed", failure: { code: codes.PAGE_CHANGED } }, "page_changed"],
    [{ status: "failed", failure: { code: codes.NAVIGATION_UNEXPECTED } }, "page_changed"],
    [{ status: "failed", failure: { code: codes.TIMEOUT } }, "action_timed_out"],
    [{ status: "timed_out" }, "action_timed_out"],
    [{ status: "failed", failure: { code: codes.OUTPUT_NOT_OBSERVED } }, "action_failed"],
    [{ status: "failed" }, "action_failed"],
    [{ status: "failed", failure: { code: "toString" } }, "action_failed"],
    [{ status: "failed", failure: { code: "__proto__" } }, "action_failed"]
  ];
  for (const [result, expected] of cases) assert.equal(webActionFailureRejectionCode(result), expected, JSON.stringify(result));
});
