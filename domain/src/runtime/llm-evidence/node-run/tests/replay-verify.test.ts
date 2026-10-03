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
import { shownPageLines } from "../../page-view/tests/shown-page-lines";
import { webNodeReplayCall } from "../replay";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const CART = "https://example.test/cart";
const PERMITTED = async () => ({ permitted: true as const });
const SAVE = { replay: "verify", node: CLICK, parameters: { selector: "#save", element: { tagName: "button" } }, consequences: ["modify_existing"], from: { location: CART } };

type AssertAnswer = { status: string; failure?: { code: string; actual?: string } };
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
  // A dry run's check is of parameters the draft already resolved: it states no new form of the step.
  assert.equal(verified.draft, undefined);
});

// Run `run-murwcaj0-40e56557` (R7, t195-w35): Core checks a rerun of a step whose
// act was already done instead of doing the act again, and the step then takes
// the rerun's new argument. That argument names a handle, which means nothing
// on the next page; the Flow runs on what it resolved to. So a check of a
// handle-written argument that passes states the resolved form, as a run does.
test("a passing check of a handle-written argument states what it resolved to, so the step can take it", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const other = shownPageLines(looked.evidence).find((line) => line.words?.includes("Move to cart"))!.target;
  const checked = await runtime.executeTool({
    ...PROJECT, callId: "rerun.6", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED,
    value: { replay: "verify", node: CLICK, parameters: { target: { handle: other } }, consequences: [], from: { location: CART } }
  });
  assert.equal(checked.resultCode, "core.replay.verified", JSON.stringify(checked.evidence).slice(0, 400));
  assert.equal(checked.effectApplied, false);
  assert.equal(stubbed.commands.some((command) => command.actionType === CLICK.replace("web.output.dom-", "web.dom.")), false);
  const ranWith = checked.draft?.ranWith as JsonObject | undefined;
  assert.equal(ranWith?.node, CLICK);
  const parameters = ranWith?.parameters as JsonObject | undefined;
  assert.equal(parameters?.selector, "#other");
  assert.equal("target" in (parameters ?? {}), false);
  assert.deepEqual(ranWith?.consequences, []);
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

// Lane A's run 40 (`run-muq6lqnw-fdfa7aac`): bigbox's "Set as my store" sat in
// the store chooser's closed flyout, the Flow never pressed the chip that opens
// it, and the check answered `present` on the step's own page. The page now
// says what hid a target it judged not shown
// (`apps/extension/src/content/action-runtime/assertion-evaluation.ts`).
const ENCLOSED: AssertAnswer = { status: "failed", failure: { code: "web.validation.state_mismatch", actual: "enclosed: it is present inside a closed container, so it is not visible" } };
const WITHDRAWN: AssertAnswer = { status: "failed", failure: { code: "web.validation.state_mismatch", actual: "it is present but not visible" } };

test("a verify whose target is there inside a closed container fails as hidden, on the very page it acted on", async () => {
  const stubbed = stub({ visible: ENCLOSED });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
  assert.equal(answered.resultCode, "core.replay.failed");
  assert.equal(answered.resultReason, "state_not_as_asserted");
  assert.equal((answered.evidence as JsonObject).ok, false);
  assert.equal((answered.evidence as JsonObject).found, "hidden");
  assert.match(String((answered.evidence as JsonObject).said), /closed container/u);
  assert.equal(answered.effectApplied, false);
  // Only the visible check went out: a hidden target is not asked whether it is enabled.
  assert.deepEqual(stubbed.commands.filter((command) => command.actionType === "web.dom.assert").map((command) => (command.parameters.assert as JsonObject).kind), ["visible"]);
});

test("a verify whose target is withdrawn itself, everything around it shown, reads as its effect in place on its own page", async () => {
  const stubbed = stub({ visible: WITHDRAWN });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
  assert.equal(answered.resultCode, "core.replay.present");
  assert.equal(answered.resultReason, undefined);
  assert.equal((answered.evidence as JsonObject).ok, true);
  assert.equal((answered.evidence as JsonObject).found, "hidden");
  assert.equal(answered.effectApplied, false);
});

test("a verify whose target is withdrawn itself on another page is unreproducible", async () => {
  const stubbed = stub({ visible: WITHDRAWN });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const value: JsonObject = { ...SAVE, from: { location: "https://example.test/product/kettle" } };
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
  assert.equal(answered.resultCode, "core.replay.unreproducible");
  assert.equal(answered.resultReason, "state_not_as_asserted");
  assert.equal((answered.evidence as JsonObject).found, "hidden");
});

test("a target the page judged hidden without saying how stays failed", async () => {
  // A client that does not say, or a record whose text was withheld: the less
  // favourable answer, as before the page could say.
  for (const actual of [undefined, "a withheld value of 12 characters", "it is present but not visible yet"]) {
    const failure: { code: string; actual?: string } = { code: "web.validation.state_mismatch" };
    if (actual !== undefined) failure.actual = actual;
    const stubbed = stub({ visible: { status: "failed", failure } });
    const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
    const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
    assert.equal(answered.resultCode, "core.replay.failed", String(actual));
    assert.equal((answered.evidence as JsonObject).found, "hidden", String(actual));
  }
});

test("only the visible check is read for what hid the target: a disabled one is disabled", async () => {
  const stubbed = stub({ enabled: WITHDRAWN });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const answered = await runtime.executeTool({ ...PROJECT, callId: "dryrun.1.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: SAVE });
  assert.equal(answered.resultCode, "core.replay.failed");
  assert.equal((answered.evidence as JsonObject).found, "disabled");
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
