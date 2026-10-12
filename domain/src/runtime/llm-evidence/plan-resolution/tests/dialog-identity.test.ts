// A handle on a control inside a named dialog keeps the dialog it was in (t469).
//
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`): the build saved a step on the chat
// panel's "Close chat" from its handle, and the saved element carried no
// `context` at all -- the dialog is not a landmark, and the packet's context
// kept only form, landmark, list, table, shadow hosts and record. At playback,
// with the chat gone, the page scored the notifications prompt's close button
// at 0.729 and pressed it (step 0062).
//
// The extension now reports the dialog an element sits in as
// `context.dialog` (`apps/extension/src/content/identity/dialog.ts`) and
// refuses a candidate in another dialog. These rows hold the domain's half:
// - the name rides beside the selector in the binding, through the handle
//   renumbering the authoring tools apply, into the node's
//   `parameters.element.context`, and on through Core's target normalizer and
//   the gateway mapping to the command the page receives;
// - the packet the model reads does not carry it;
// - a control in no dialog saves none, and a name the secret screen withheld
//   is not saved, so it cannot refuse every replay.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";

const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const FEED_URL = "https://example.test/friends/requests/";
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];
const CHAT = "Chat with Elena Sokolova";

/** The chat panel's close button, as the extension describes it from social-network-feed. */
const closeChat: JsonObject = {
  tagName: "div",
  selector: "body > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(3)",
  role: "button",
  accessibleName: "Close chat",
  visibleText: "✕",
  attributes: { "aria-label": "Close chat", class: "x1pycuky xu37y6r" },
  context: { dialog: CHAT }
};
/** The notifications prompt's close button: the same control by every other signal. */
const promptClose: JsonObject = {
  tagName: "div",
  selector: "body > div:nth-of-type(4) > div > div:nth-of-type(1) > div",
  role: "button",
  accessibleName: "Close",
  visibleText: "✕",
  attributes: { "aria-label": "Close", class: "x1pycuky xu37y6r" },
  context: { dialog: "Turn on notifications?" }
};
/** A control on the page, in no dialog. */
const confirm: JsonObject = { tagName: "div", selector: "main li:nth-of-type(1) [aria-label=Confirm]", role: "button", accessibleName: "Confirm", visibleText: "Confirm" };

function runtimeOver(elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      return { status: "succeeded", payload: { snapshot: { url: FEED_URL, title: "Friend requests", interactiveElements: elements } } };
    }
  });
}

async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.inspect", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

async function resolvedParameters(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<JsonObject> {
  const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle } }, declaredConsequences: NOTHING_LASTING });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** The element the page is handed, through Core's target normalizer and the gateway mapping, as a Flow node's dispatch takes it. */
function dispatchedElement(parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

const contextOf = (element: unknown): JsonObject | undefined => (element as { context?: JsonObject } | undefined)?.context;

test("a step built from a handle inside a named dialog saves the dialog, and the page receives it", async () => {
  const runtime = runtimeOver([confirm, closeChat, promptClose]);
  await inspect(runtime);

  const saved = await resolvedParameters(runtime, "t2");
  assert.equal((saved.element as JsonObject).accessibleName, "Close chat");
  assert.deepEqual(contextOf(saved.element), { dialog: CHAT });

  const element = dispatchedElement(saved);
  assert.deepEqual(contextOf(element), { dialog: CHAT }, "the dialog survives Core's normalizer and the gateway mapping");
  assert.equal(element?.accessibleName, "Close chat");

  // The look-alike in the other dialog saves its own.
  assert.deepEqual(contextOf((await resolvedParameters(runtime, "t3")).element), { dialog: "Turn on notifications?" });
});

test("a step built from a control in no dialog saves none", async () => {
  const runtime = runtimeOver([confirm, closeChat]);
  await inspect(runtime);
  const saved = await resolvedParameters(runtime, "t1");
  assert.equal(contextOf(saved.element)?.dialog, undefined);
  assert.equal(contextOf(dispatchedElement(saved))?.dialog, undefined);
});

test("the packet the model reads does not carry the dialog; the binding keeps it beside the selector", () => {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: FEED_URL, interactiveElements: [confirm, closeChat] });
  assert.equal(JSON.stringify(binding.evidence).includes(CHAT), false);
  assert.equal(binding.dialogNames?.get("t2"), CHAT);
  assert.equal(binding.dialogNames?.has("t1"), false);
});

test("a dialog name the secret screen withheld is not saved", () => {
  const secret = { ...closeChat, context: { dialog: "Card 4111 1111 1111 1111 saved" } };
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: FEED_URL, interactiveElements: [secret] });
  assert.equal(binding.dialogNames?.has("t1"), false);
});
