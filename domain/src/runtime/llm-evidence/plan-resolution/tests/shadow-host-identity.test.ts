// A handle on a control inside an open shadow root keeps the root it was in.
//
// The extension describes such a control with a selector written within the
// root and, beside it, the chain of shadow hosts to walk first
// (`context.shadowHosts`). The packet a model reads carries neither: the
// selector stays in the binding, and until this change the chain was dropped
// altogether. A created Flow's click then reached the page with a selector
// that names nothing in the document -- found only by the page-side search of
// every open root that a click falls back on -- and its wait, which has no such
// fallback, timed out on the job board's consent wall (`run-mulwm2dc-0bd95f22`).
//
// What these rows hold:
// - the chain rides beside the selector, through the handle renumbering the
//   authoring tools apply, into the node's `parameters.element.context` --
//   the key a recorded node already carries -- and on through Core's target
//   normalizer and the gateway mapping to the command the page receives;
// - the packet the model reads still carries no chain;
// - two widgets that give their controls the same selector inside their own
//   roots are two addresses, not one shared selector;
// - a chain with one unreadable host is dropped whole, never half-kept.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmTargetPackets } from "..";

const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const WAIT_NODE = webAutomationOutputNodeId("web.dom.wait_for_selector");
const BOARD_URL = "https://example.test/jobs";
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

/** The consent wall's Reject button, as the extension describes it from inside `rf-consent`'s open root. */
const reject: JsonObject = {
  tagName: "button",
  selector: "section > div:nth-of-type(2) > button:nth-of-type(2)",
  visibleText: "Reject non-essential",
  accessibleName: "Reject non-essential",
  implicitRole: "button",
  context: { shadowHosts: ["body > rf-consent"] }
};
const search: JsonObject = { tagName: "input", selector: 'input[name="q"]', inputType: "text", accessibleName: "What", context: { formId: "search" } };

function runtimeOver(elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: BOARD_URL, title: "Board", interactiveElements: elements } } };
    }
  });
}

async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

async function resolvedParameters(runtime: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject): Promise<JsonObject> {
  const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters, declaredConsequences: NOTHING_LASTING });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** The element the page is handed, through Core's target normalizer and the gateway mapping, as a Flow node's dispatch takes it. */
function dispatchedElement(actionType: string, parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType, parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

test("a click and a wait resolved from a handle inside a shadow root carry its host chain to the page", async () => {
  const runtime = runtimeOver([search, reject]);
  await inspect(runtime);

  const clicked = await resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "t2" } });
  assert.deepEqual(clicked.element, {
    tagName: "button",
    implicitRole: "button",
    accessibleName: "Reject non-essential",
    // No `visibleText`: the packet does not repeat text that is the name.
    selector: reject.selector,
    context: { shadowHosts: ["body > rf-consent"] }
  });
  const waited = await resolvedParameters(runtime, WAIT_NODE, { selector: { handle: "t2" } });
  assert.deepEqual((waited.element as JsonObject | undefined)?.context, { shadowHosts: ["body > rf-consent"] });

  const element = dispatchedElement("web.dom.click", clicked);
  assert.deepEqual((element?.context as JsonObject | undefined)?.shadowHosts, ["body > rf-consent"], "the chain survives Core's normalizer and the gateway mapping");

  // A light-document control's identity is what it always was.
  const typed = await resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "t1" } });
  assert.deepEqual((typed.element as JsonObject).context, { formId: "search" });
});

test("the packet the model reads carries no host chain; the binding keeps it beside the selector", () => {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: BOARD_URL, interactiveElements: [search, reject] });
  assert.equal(JSON.stringify(binding.evidence).includes("rf-consent"), false);
  assert.deepEqual(binding.shadowHosts?.get("t2"), ["body > rf-consent"]);
  assert.equal(binding.shadowHosts?.has("t1"), false);
});

test("two widgets giving their buttons one selector inside their own roots are two addresses, not a shared selector", () => {
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  const inWidget = (host: string, text: string): JsonObject => ({ tagName: "button", selector: "button.primary", visibleText: text, context: { shadowHosts: [host] } });
  targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({ url: BOARD_URL, interactiveElements: [inWidget("body > rf-consent", "Accept all"), inWidget("body > rf-assistant", "Send")] }));
  const first = targets.resolve(scope, "t1", BOARD_URL);
  const second = targets.resolve(scope, "t2", BOARD_URL);
  assert.equal(first.ok && first.element.context?.shadowHosts?.[0], "body > rf-consent");
  assert.equal(second.ok && second.element.context?.shadowHosts?.[0], "body > rf-assistant");

  // The same selector twice in one root is still one shared selector.
  targets.remember(scope, sanitizeWebLlmSnapshotWithBindings({ url: BOARD_URL, interactiveElements: [inWidget("body > rf-consent", "Accept all"), inWidget("body > rf-consent", "Accept all")] }));
  assert.deepEqual(targets.resolve(scope, "t1", BOARD_URL), { ok: false, code: "not_unique" });
});

test("a chain with one unreadable host is dropped whole", () => {
  const broken = { ...reject, context: { shadowHosts: ["body > rf-consent", ""] } };
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: BOARD_URL, interactiveElements: [broken] });
  assert.equal(binding.shadowHosts?.has("t1"), false);
});
