// Verifying a step whose effect lasts, rather than running it again.
//
// Decision D1 (t174, 2026-09-30): a dry run never repeats a lasting effect.
// Core sends `replay: "verify"` for such a step (`AS/runtime/flow-draft/verify-only.ts`)
// and this domain checks the step could run now -- its parameters resolve and
// its target is there, visible and enabled -- and dispatches nothing that acts.
// Run 21 (`run-muntufao-7b7bc04a`) is why: replaying a save press moved both of
// a person's cart lines to the saved list.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webNodeReplayCall } from "../replay";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const START = "https://example.test/cart";
const PERMITTED = async () => ({ permitted: true as const });
const SAVE = { replay: "verify", node: CLICK, parameters: { selector: "#save", element: { tagName: "button" } }, consequences: ["modify_existing"] };

type AssertAnswer = { status: string; failure?: { code: string } };

test("a verify is a replay call of its own kind", () => {
  assert.equal(webNodeReplayCall({ replay: "verify" }), "verify");
  assert.equal(webNodeReplayCall({ replay: "step" }), "step");
  assert.equal(webNodeReplayCall({ replay: "again" }), undefined);
});

test("a verify resolves the step and checks its target without acting on it", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const checks: unknown[] = [];
  const verified = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
    permission: async (request) => { checks.push(request); return { permitted: true as const }; },
    value: SAVE
  });
  assert.equal(verified.resultCode, "core.replay.verified");
  // Nothing was done, so nothing is claimed to have been.
  assert.equal(verified.effectApplied, false);
  assert.equal((verified.evidence as JsonObject).ok, true);
  // The press itself never went out: only read-only checks did, on the same
  // target the Flow would press.
  assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
  const asserted = stubbed.commands.filter((command) => command.actionType === "web.dom.assert");
  assert.deepEqual(asserted.map((command) => (command.parameters.assert as JsonObject).kind), ["visible", "enabled"]);
  assert.deepEqual(asserted.map((command) => command.parameters.selector), ["#save", "#save"]);
  assert.deepEqual(asserted[0]?.parameters.element, { tagName: "button" });
  // The person is not asked about a lasting consequence for a check that has none.
  assert.equal(checks.every((request) => (request as { consequences: unknown[] }).consequences.length === 0), true);
});

test("a verify whose target is missing says so, the way a site that remembers the step looks", async () => {
  for (const missing of [{ status: "timed_out", failure: { code: "web.action.timeout" } }, { status: "failed", failure: { code: "web.target.not_found" } }]) {
    const stubbed = stub({ visible: missing });
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
    assert.equal(answered.resultCode, "core.replay.unreproducible", JSON.stringify(missing));
    assert.equal(answered.resultReason, "handle_no_longer_on_page");
    assert.equal((answered.evidence as JsonObject).found, "missing");
    assert.equal(answered.effectApplied, false);
    assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
  }
});

test("a verify whose target is there but disabled or hidden fails, and says which", async () => {
  const mismatch = { status: "failed", failure: { code: "web.validation.state_mismatch" } };
  for (const [options, found] of [[{ enabled: mismatch }, "disabled"], [{ visible: mismatch }, "hidden"]] as const) {
    const stubbed = stub(options);
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
    assert.equal(answered.resultCode, "core.replay.failed", found);
    assert.equal(answered.resultReason, "state_not_as_asserted", found);
    assert.equal((answered.evidence as JsonObject).found, found);
    assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
  }
});

test("a verify of a step that names no element checks only that it resolves", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const answered = await runtime.executeTool({
    ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "verify", node: "web.output.browser-navigate", parameters: { url: START }, consequences: ["send_or_publish"] }
  });
  assert.equal(answered.resultCode, "core.replay.verified");
  assert.equal(stubbed.commands.length, 0);
});

function stub(options: { visible?: AssertAnswer; enabled?: AssertAnswer } = {}) {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page() } };
      if (command.actionType === "web.dom.assert") {
        const kind = (command.parameters.assert as JsonObject).kind;
        const answer = kind === "visible" ? options.visible : options.enabled;
        return answer ? { ...answer, error: "no" } : { status: "succeeded", payload: {} };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, commands };
}

function page(): JsonObject {
  return {
    url: START,
    title: "Cart",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#save", visibleText: "Save for later" }]
  };
}
