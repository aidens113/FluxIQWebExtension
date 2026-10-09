// A press names a control (t378, lane D).
//
// Live (`run-mv0fuual-f9e6f089`, view 14): the chat panel printed
// `t857 button "Close chat"` and, under it, the plain text line
// `t860 "I can bring the gazebo if you need it"`. The candidate's "close the
// chat if it shows" step pressed `t860`, the resolver made it real, and both
// trials pressed the message, which closed nothing.
//
// Held here: a candidate's press whose handle names an element the page view
// prints as plain text -- no control role, no press listener or cursor of its
// own, no control around it -- is refused `web.handle.not_a_control`. A real
// control still resolves, a control the page draws itself (a colour swatch, a
// chip) included, as do the words inside a control and a label, which presses
// the control it names. Exploration's own presses are not held to it: the
// model may press anything a person could.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmExtractionHandles } from "../../structure";
import { webLlmPageText } from "../../page-view";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "..";

const SCOPE = { projectId: "project.press", flowId: "flow.press" };
const PAGE = "https://circleway.test/friends/requests/";
const CLICK = webAutomationOutputNodeId("web.dom.click");
const CHECK = webAutomationOutputNodeId("web.dom.check");

/** The page, `parent` being each element's index in this list, as a capture writes it. */
const ELEMENTS: JsonObject[] = [
  // 0: the chat panel, which listens for presses anywhere on it.
  { tagName: "div", selector: "#chat", role: "dialog", accessibleName: "Chat with Elena Sokolova", hasClickHandler: true },
  // 1: its close button.
  { tagName: "button", selector: "#chat button.close", accessibleName: "Close chat", parent: 0 },
  // 2-3: the messages, plain text.
  { tagName: "div", selector: "#chat .messages", parent: 0 },
  { tagName: "p", selector: "#chat .messages > p:nth-child(2)", visibleText: "I can bring the gazebo if you need it", parent: 2 },
  // 4: a colour swatch the page draws itself.
  { tagName: "div", selector: "#swatch-red", accessibleName: "Red", hasClickHandler: true },
  // 5: a filter chip with a pointer of its own.
  { tagName: "span", selector: "#chip-pickup", visibleText: "Pickup today", cursor: "pointer" },
  // 6-7: an "Add" button, and the words inside it.
  { tagName: "button", selector: "#add" },
  { tagName: "span", selector: "#add > span", visibleText: "Add", parent: 6 },
  // 8: a label, which presses the checkbox it names.
  { tagName: "label", selector: "label[for=remember]", visibleText: "Remember me" },
  // 9: a heading.
  { tagName: "h2", selector: "#requests-title", visibleText: "Friend requests" }
];

function page() {
  const targets = createWebLlmTargetPackets();
  const capture = createWebLlmStableTargetHandles().restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: PAGE, interactiveElements: ELEMENTS }));
  targets.remember(SCOPE, capture);
  const handleOf = (selector: string): string => {
    const found = capture.evidence.elements.find((element) => capture.selectors.get(element.target) === selector);
    if (found === undefined) throw new Error(`no handle for ${selector}`);
    return found.target;
  };
  return { capture, handleOf, stores: { targets, extractions: createWebLlmExtractionHandles() } };
}

function press(handle: string, extra: Partial<WebPlanNodeResolutionInput> = {}, nodeDefinitionId = CLICK): WebPlanNodeResolutionInput {
  return { ...SCOPE, nodeDefinitionId, parameters: { target: { handle } }, declaredConsequences: [], permission: async () => ({ permitted: true as const }), ...extra };
}

test("a candidate's press on a plain text line is refused web.handle.not_a_control; exploration's press on it is not", async () => {
  const { capture, handleOf, stores } = page();
  const message = handleOf("#chat .messages > p:nth-child(2)");
  const text = webLlmPageText(capture.evidence);
  assert.match(text, new RegExp(`^${message} "I can bring the gazebo if you need it"$`, "mu"), "printed as plain text, as t860 was");

  const answer = await resolveWebPlanNodeParameters(press(message, { handleReach: "view_history" }), stores);
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status === "refused") {
    assert.equal(answer.issueCodes[0], "web.handle.not_a_control");
    assert.ok(answer.issueCodes.includes("web.handle.not_a_control:target"), JSON.stringify(answer.issueCodes));
  }
  const heading = await resolveWebPlanNodeParameters(press(handleOf("#requests-title"), { handleReach: "view_history" }), stores);
  assert.equal(heading.status, "refused", JSON.stringify(heading));

  const explored = await resolveWebPlanNodeParameters(press(message), stores);
  assert.equal(explored.status, "resolved", JSON.stringify(explored));
});

test("a candidate's press inside a Run Output node is held to the same rule", async () => {
  const { handleOf, stores } = page();
  const answer = await resolveWebPlanNodeParameters({
    ...SCOPE,
    nodeDefinitionId: "builtin.policy.action",
    parameters: { outputId: "web.dom.click", parameters: { target: { handle: handleOf("#chat .messages > p:nth-child(2)") } } },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleReach: "view_history"
  }, stores);
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status === "refused") assert.equal(answer.issueCodes[0], "web.handle.not_a_control");
});

test("a press on a real control resolves: a button, a drawn swatch and chip, words inside a button, a label", async () => {
  const { handleOf, stores } = page();
  for (const selector of ["#chat button.close", "#swatch-red", "#chip-pickup", "#add > span", "label[for=remember]"]) {
    const answer = await resolveWebPlanNodeParameters(press(handleOf(selector), { handleReach: "view_history" }), stores);
    assert.equal(answer.status, "resolved", `${selector}: ${JSON.stringify(answer)}`);
    if (answer.status === "resolved") assert.equal(answer.parameters.selector, selector);
  }
});

test("only a press is held to it: a check on the drawn swatch resolves", async () => {
  const { handleOf, stores } = page();
  const check = press(handleOf("#swatch-red"), { handleReach: "view_history" }, CHECK);
  check.parameters = { target: { handle: handleOf("#swatch-red") }, checked: true };
  const answer = await resolveWebPlanNodeParameters(check, stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
});
