// What a model wrote names an element by handle and nothing else, or is
// refused (t432; the user's rule of 2026-10-10: the model names elements by the
// handles the page view printed, and the rest "is all handled by extension").
//
// Core says when a node's parameters are the model's own (`writtenByModel`: a
// candidate script, a reply's plan, an in-run repair's steps); exploration's
// own call always is. Then a literal locator, an identity or a recorded visual
// target the model wrote is refused at its position, never run as written, and
// an element node naming no element is refused too. A hand-authored, recorded
// or drafted step is not flagged, and its literal selector still stands.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { webPlanWrittenLiterals } from "../written-literals";

const CLICK = webAutomationOutputNodeId("web.dom.click");
const TYPE = webAutomationOutputNodeId("web.dom.type");
const SCROLL = webAutomationOutputNodeId("web.dom.scroll");
const WAIT = webAutomationOutputNodeId("web.dom.wait_for_selector");
const LIST = webAutomationOutputNodeId("web.dom.extract_list");
const NEXT = webAutomationOutputNodeId("web.dom.next_page");
const NAVIGATE = webAutomationOutputNodeId("web.browser.navigate");

const URL = "https://example.test/tickets";
const ELEMENTS: JsonObject[] = [
  { tagName: "button", selector: "#renew", visibleText: "Renew", accessibleName: "Renew", attributes: { "data-testid": "renew" } },
  { tagName: "input", selector: "input[name=\"seat\"]", inputType: "text", accessibleName: "Seat", attributes: { name: "seat", type: "text" } }
];

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: URL, title: "Tickets", interactiveElements: ELEMENTS } } }
      : { status: "succeeded" }
  });
}

async function shown(): Promise<WebAutomationLlmEvidenceRuntime> {
  const made = runtime();
  await made.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  return made;
}

async function written(made: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject, byModel = true) {
  const input: Parameters<WebAutomationLlmEvidenceRuntime["resolvePlanNodeParameters"]>[0] = { projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters, declaredConsequences: [] };
  if (byModel) input.writtenByModel = true;
  return await made.resolvePlanNodeParameters(input);
}

const NOT_A_HANDLE = "web.handle.not_a_handle";
const TARGET_HINT = "web.handle.expected.target.handle_location";
const refusedAt = (reason: string, ...positions: string[]) => ({ status: "refused", issueCodes: [reason, TARGET_HINT, ...positions.map((position) => `${reason}:${position}`)] });

test("a literal locator the model wrote is refused at its position, not run as written", async () => {
  const made = await shown();
  assert.deepEqual(await written(made, CLICK, { selector: "#renew" }), refusedAt(NOT_A_HANDLE, "selector"));
  assert.deepEqual(await written(made, TYPE, { target: "input[name=seat]", text: "12A" }), refusedAt(NOT_A_HANDLE, "target"));
  assert.deepEqual(await written(made, CLICK, { target: { selector: "#renew" } }), refusedAt(NOT_A_HANDLE, "target"));
  // A bare token is not a handle reference in a plan: the script reader writes `{ handle }`.
  assert.deepEqual(await written(made, CLICK, { selector: "t1" }), refusedAt(NOT_A_HANDLE, "selector"));
  // A node whose element is optional is held to it too: a scroll to an element, a wait for one.
  assert.deepEqual(await written(made, SCROLL, { selector: "#renew", scroll: { mode: "toElement" } }), refusedAt(NOT_A_HANDLE, "selector"));
  assert.deepEqual(await written(made, WAIT, { selector: ".spinner", wait: { condition: "absent" } }), refusedAt(NOT_A_HANDLE, "selector"));
});

test("a literal written beside a handle, an identity the model described, or a recorded visual target is refused, never silently replaced", async () => {
  const made = await shown();
  assert.deepEqual(await written(made, CLICK, { target: { handle: "t1" }, selector: "button.guessed" }), refusedAt(NOT_A_HANDLE, "selector"));
  assert.deepEqual(await written(made, CLICK, { target: { handle: "t1" }, element: { tagName: "button", visibleText: "Renew" } }), refusedAt(NOT_A_HANDLE, "element"));
  assert.deepEqual(await written(made, CLICK, { target: { handle: "t1" }, visualTarget: { bounds: { x: 1, y: 2 } } }), refusedAt(NOT_A_HANDLE, "visualTarget"));
  // The locator form of an expected state; a model writes `done when:` facts, which name their element by handle.
  assert.deepEqual(
    await written(made, CLICK, { target: { handle: "t1" }, expectedState: { conditions: [{ kind: "exists", selector: ".renewed" }] } }),
    refusedAt(NOT_A_HANDLE, "expectedState.conditions.0.selector")
  );
});

test("an element node naming no element is refused, where a hidden parameter used to be reported missing", async () => {
  const made = await shown();
  assert.deepEqual(await written(made, CLICK, {}), refusedAt("web.handle.required", "target"));
  assert.deepEqual(await written(made, TYPE, { text: "12A" }), refusedAt("web.handle.required", "target"));
  // A node with no element to name, and one whose element is optional, is not.
  assert.deepEqual(await written(made, NAVIGATE, { url: URL }), { status: "unchanged" });
  assert.deepEqual(await written(made, SCROLL, { y: 400 }), { status: "unchanged" });
});

test("a literal list read or Next page request the model wrote is refused as a guess", async () => {
  const made = await shown();
  const read = await written(made, LIST, { extractList: { item: "li.row", fields: { title: ".title" } } });
  assert.equal(read.status, "refused");
  assert.equal(read.status === "refused" && read.issueCodes.includes("web.handle.extraction_required"), true, JSON.stringify(read));
  const next = await written(made, NEXT, { nextPage: { item: "li.row", next: "a.more" } });
  assert.equal(next.status === "refused" && next.issueCodes.includes(NOT_A_HANDLE), true, JSON.stringify(next));
  assert.equal(next.status === "refused" && next.issueCodes.includes("web.handle.expected.next_page.list_control"), true);
});

test("a Run Output node's payload is held to the same rule", async () => {
  const made = await shown();
  const answer = await written(made, "builtin.policy.action", { outputId: "web.dom.click", parameters: { selector: "#renew" } });
  assert.equal(answer.status === "refused" && answer.issueCodes.includes(`${NOT_A_HANDLE}:parameters.selector`), true, JSON.stringify(answer));
});

test("a handle the model wrote still resolves to the address and the identity the page view never printed", async () => {
  const made = await shown();
  const answer = await written(made, CLICK, { target: { handle: "t1" } });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  assert.equal(answer.status === "resolved" && answer.parameters.selector, "#renew");
});

test("a step the host wrote is not flagged, and its literal selector stands as written", async () => {
  const made = await shown();
  assert.deepEqual(await written(made, CLICK, { selector: "#renew" }, false), { status: "unchanged" });
  assert.deepEqual(await written(made, CLICK, { selector: "#renew", expectedState: { conditions: [{ kind: "exists", selector: ".renewed" }] } }, false), { status: "unchanged" });
});

test("the literals are found by position, and nothing is found for a node named only by handle", () => {
  assert.deepEqual(webPlanWrittenLiterals(CLICK, { target: { $state: { path: "row.control", fallback: { handle: "t1" } } } }, true), []);
  assert.deepEqual(webPlanWrittenLiterals(CLICK, { target: { $state: { path: "row.control" } } }, true), [{ code: NOT_A_HANDLE, path: ["target"] }]);
  assert.deepEqual(webPlanWrittenLiterals(CLICK, { selector: { handle: "t1" }, element: { handle: "t1" } }, true), []);
  // A node that takes no element is judged only on its expected state.
  assert.deepEqual(webPlanWrittenLiterals(NAVIGATE, { url: URL }, false), []);
});

// An amendment's settings over a draft step are the model's own; the rest of
// the step is what it ran with (Core's `modelWrittenParameters`, amend_draft).
test("only the parameters an amendment wrote are judged, and nothing is required of a step the host wrote", async () => {
  const made = await shown();
  const amended = async (parameters: JsonObject, modelWrittenParameters: string[]) =>
    await made.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK, parameters, declaredConsequences: [], modelWrittenParameters });
  // The step ran with its resolved address; the amendment wrote a locator condition.
  assert.deepEqual(
    await amended({ selector: "#renew", expectedState: { conditions: [{ kind: "exists", selector: ".renewed" }] } }, ["expectedState"]),
    refusedAt(NOT_A_HANDLE, "expectedState.conditions.0.selector")
  );
  // An amendment that wrote a locator over the step's element is refused at it.
  assert.deepEqual(await amended({ selector: "#guessed" }, ["selector"]), refusedAt(NOT_A_HANDLE, "selector"));
  // The address the step ran with, and a wait the amendment wrote, stand; no element is required of it.
  assert.deepEqual(await amended({ selector: "#renew", wait: { condition: "visible" } }, ["wait"]), { status: "unchanged" });
  assert.deepEqual(await amended({}, ["wait"]), { status: "unchanged" });
});
