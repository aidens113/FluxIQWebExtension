// Checking a step whose effect lasts, rather than running it again.
//
// Decision D1 (2026-09-30): a dry run never clears site data or logs the person
// out, never repeats a lasting effect, and checks a changing step -- its target
// could take the action, or its effect is already in place -- rather than
// running it again. Core sends `replay: "verify"` for such a step, with where
// the step found the page (`AS/runtime/flow-draft/verify-only.ts`), and this
// domain checks it and dispatches nothing that acts. Run 21
// (`run-muntufao-7b7bc04a`) is why: replaying a save press moved both of a
// person's cart lines to the saved list. t193-wH (`run-munri5gr-94d7f8a0`) is
// why a target gone from the page it acted on passes: that is the effect
// already in place.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webNodeReplayCall } from "../replay";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const CART = "https://example.test/cart";
const PERMITTED = async () => ({ permitted: true as const });
const SAVE = { replay: "verify", node: CLICK, parameters: { selector: "#save", element: { tagName: "button" } }, consequences: ["modify_existing"], from: { location: CART } };

type AssertAnswer = { status: string; failure?: { code: string } };
const NOT_THERE: readonly AssertAnswer[] = [{ status: "timed_out", failure: { code: "web.action.timeout" } }, { status: "failed", failure: { code: "web.target.not_found" } }];

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
  // The press itself never went out, and nothing that clears or leaves the
  // page did either: only read-only checks, on the target the Flow would press.
  assert.deepEqual([...new Set(stubbed.commands.map((command) => command.actionType))], ["web.dom.assert"]);
  const asserted = stubbed.commands.filter((command) => command.actionType === "web.dom.assert");
  assert.deepEqual(asserted.map((command) => (command.parameters.assert as JsonObject).kind), ["visible", "enabled"]);
  assert.deepEqual(asserted.map((command) => command.parameters.selector), ["#save", "#save"]);
  assert.deepEqual(asserted[0]?.parameters.element, { tagName: "button" });
  // The person is not asked about a lasting consequence for a check that has none.
  assert.equal(checks.every((request) => (request as { consequences: unknown[] }).consequences.length === 0), true);
});

test("a verify whose target is gone from the page the step acted on says its effect is already in place, and passes", async () => {
  for (const missing of NOT_THERE) {
    const stubbed = stub({ visible: missing });
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
    assert.equal(answered.resultCode, "core.replay.present", JSON.stringify(missing));
    assert.equal(answered.resultReason, undefined);
    assert.equal((answered.evidence as JsonObject).ok, true);
    assert.equal((answered.evidence as JsonObject).found, "missing");
    assert.equal(answered.effectApplied, false);
    assert.equal(stubbed.commands.some((command) => command.actionType === "web.dom.click"), false);
  }
});

test("a verify whose target is gone and whose page is not the one it acted on is unreproducible", async () => {
  // Run 18's shape: the steps that reach the product page were withdrawn, so
  // the add-to-cart is checked on the search results.
  for (const from of [{ location: "https://example.test/product/kettle" }, undefined]) {
    const stubbed = stub({ visible: NOT_THERE[1]! });
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    const value: JsonObject = { ...SAVE };
    if (from) value.from = from;
    else delete value.from;
    const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
    assert.equal(answered.resultCode, "core.replay.unreproducible", JSON.stringify(from));
    assert.equal(answered.resultReason, "handle_no_longer_on_page");
    assert.equal((answered.evidence as JsonObject).found, "missing");
    assert.equal(answered.effectApplied, false);
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
    value: { replay: "verify", node: "web.output.browser-navigate", parameters: { url: CART }, consequences: ["send_or_publish"] }
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
    url: CART,
    title: "Cart",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "#other", visibleText: "Move to cart" }]
  };
}
