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

// A candidate's type step names a field (t486).
//
// Round 12 build 1 (`run-mv62icw0-2be384b4`): revision 1's s9 typed into
// `t932 "1"`, a quantity the page view printed as plain text, not a field.
// The submission was accepted and only the trial found out, where the failure
// was marked retryable and retried three times.
//
// Held here: a candidate's type step whose handle names an element nothing can
// be typed into -- no text input, no textarea, nothing editable by its own
// `contenteditable` or an editable host around it -- is refused
// `web.handle.not_a_field` (the model reads `handle_not_a_field`), beside
// `web.handle.target_kind.<kind>` naming what the element is, as the page view
// prints it, and the node that does act on it where its kind says (a checkbox
// is pressed). A clear step is held to the same. A field the view prints by its role
// alone (a combobox) is not refused: this refuses only what is known wrong.
// Exploration's own typing is not held to it; the extension answers that
// at once and not retryably (`apps/extension/src/content/actions/type.ts`).

const TYPING_SCOPE = { projectId: "project.type", flowId: "flow.type" };
const TYPING_PAGE = "https://valueridge.test/p/paper-towels";
const TYPE = webAutomationOutputNodeId("web.dom.type");
const CLEAR = webAutomationOutputNodeId("web.dom.clear");

/** The page, `parent` being each element's index in this list, as a capture writes it. */
const TYPING_ELEMENTS: JsonObject[] = [
  // 0: the quantity, printed as text between its steppers.
  { tagName: "span", selector: "#qty-value", visibleText: "1", id: "qty-value", classNames: ["qty-value"] },
  // 1: a text input.
  { tagName: "input", selector: "#search", inputType: "search", accessibleName: "Search products", id: "search", name: "q" },
  // 2: a textarea.
  { tagName: "textarea", selector: "#note", accessibleName: "Delivery note", id: "note" },
  // 3-4: a rich editor and a run of text inside it.
  { tagName: "div", selector: "#editor", attributes: { contenteditable: "true" }, accessibleName: "Review", id: "editor" },
  { tagName: "span", selector: "#editor > span", visibleText: "Great towels", parent: 3, classNames: ["run"] },
  // 5: a combobox drawn by role.
  { tagName: "div", selector: "#store-picker", role: "combobox", accessibleName: "Pick a store", id: "store-picker" },
  // 6: a heading.
  { tagName: "h1", selector: "#title", visibleText: "Paper Towels, 12 Double Rolls", id: "title" },
  // 7: a checkbox.
  { tagName: "input", selector: "#gift", inputType: "checkbox", accessibleName: "Gift wrap", id: "gift" },
  // 8: a file input.
  { tagName: "input", selector: "#photo", inputType: "file", accessibleName: "Add a photo", id: "photo" },
  // 9: a part of the editor the page marked not editable.
  { tagName: "span", selector: "#editor > .mention", visibleText: "@valueridge", parent: 3, attributes: { contenteditable: "false" }, classNames: ["mention"] }
];

function typingPage() {
  const targets = createWebLlmTargetPackets();
  const capture = createWebLlmStableTargetHandles().restamp(TYPING_SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: TYPING_PAGE, interactiveElements: TYPING_ELEMENTS }));
  targets.remember(TYPING_SCOPE, capture);
  const handleOf = (selector: string): string => {
    const found = capture.evidence.elements.find((element) => capture.selectors.get(element.target) === selector);
    if (found === undefined) throw new Error(`no handle for ${selector}`);
    return found.target;
  };
  // The view folds an editor's own text into the editor's line; a page search prints each run on its own.
  targets.printed(TYPING_SCOPE, `${handleOf("#editor > span")} "Great towels"
${handleOf("#editor > .mention")} "@valueridge"`);
  return { capture, handleOf, stores: { targets, extractions: createWebLlmExtractionHandles() } };
}

function type(handle: string, extra: Partial<WebPlanNodeResolutionInput> = {}): WebPlanNodeResolutionInput {
  return { ...TYPING_SCOPE, nodeDefinitionId: TYPE, parameters: { target: { handle }, text: "2" }, declaredConsequences: [], permission: async () => ({ permitted: true as const }), ...extra };
}

test("a candidate's type into text the view printed is refused web.handle.not_a_field, naming it text", async () => {
  const { capture, handleOf, stores } = typingPage();
  const quantity = handleOf("#qty-value");
  assert.match(webLlmPageText(capture.evidence), new RegExp(`^${quantity} "1"$`, "mu"), "printed as plain text, as t932 was");

  const answer = await resolveWebPlanNodeParameters(type(quantity, { handleReach: "view_history" }), stores);
  assert.equal(answer.status, "refused", JSON.stringify(answer));
  if (answer.status === "refused") {
    assert.deepEqual(answer.issueCodes, ["web.handle.not_a_field", "web.handle.target_kind.text", "web.handle.not_a_field:target"]);
  }
  const held = stores.targets.resolve(TYPING_SCOPE, quantity, undefined, "view_history");
  assert.equal(held.ok && held.notAField, "text");
});

test("a heading, a checkbox, a file input and a part marked not editable are refused, each named by its kind", async () => {
  const { handleOf, stores } = typingPage();
  for (const [selector, kind] of [["#title", "heading"], ["#gift", "checkbox"], ["#photo", "file_input"], ["#editor > .mention", "text"]] as const) {
    const answer = await resolveWebPlanNodeParameters(type(handleOf(selector), { handleReach: "view_history" }), stores);
    assert.equal(answer.status, "refused", `${selector}: ${JSON.stringify(answer)}`);
    if (answer.status === "refused") {
      assert.equal(answer.issueCodes[0], "web.handle.not_a_field", selector);
      assert.ok(answer.issueCodes.includes(`web.handle.target_kind.${kind}`), `${selector}: ${JSON.stringify(answer.issueCodes)}`);
    }
    const held = stores.targets.resolve(TYPING_SCOPE, handleOf(selector), undefined, "view_history");
    assert.equal(held.ok && held.notAField, kind, selector);
  }
  // A clear step is held to the same.
  const clearing = type(handleOf("#title"), { handleReach: "view_history" });
  clearing.nodeDefinitionId = CLEAR;
  const cleared = await resolveWebPlanNodeParameters(clearing, stores);
  assert.ok(cleared.status === "refused" && cleared.issueCodes.includes("web.handle.target_kind.heading"), JSON.stringify(cleared));
  // A checkbox is pressed: the refusal names the node that does act on it.
  const checkbox = await resolveWebPlanNodeParameters(type(handleOf("#gift"), { handleReach: "view_history" }), stores);
  assert.ok(checkbox.status === "refused" && checkbox.issueCodes.includes("web.handle.expected.node.web.output.dom-click"), JSON.stringify(checkbox));
});

test("a field resolves: a text input, a textarea, an editable host, text inside one, a role-drawn combobox", async () => {
  const { handleOf, stores } = typingPage();
  for (const selector of ["#search", "#note", "#editor", "#editor > span", "#store-picker"]) {
    const answer = await resolveWebPlanNodeParameters(type(handleOf(selector), { handleReach: "view_history" }), stores);
    assert.equal(answer.status, "resolved", `${selector}: ${JSON.stringify(answer)}`);
  }
});

test("exploration's own typing is not refused for it, and no other node is", async () => {
  const { handleOf, stores } = typingPage();
  const explored = await resolveWebPlanNodeParameters(type(handleOf("#qty-value"), { gatedByCaller: true }), stores);
  assert.equal(explored.status, "resolved", JSON.stringify(explored));
  const pressed = await resolveWebPlanNodeParameters({
    projectId: TYPING_SCOPE.projectId,
    flowId: TYPING_SCOPE.flowId,
    nodeDefinitionId: CLICK,
    parameters: { target: { handle: handleOf("#gift") } },
    declaredConsequences: [],
    permission: async () => ({ permitted: true as const }),
    handleReach: "view_history"
  }, stores);
  assert.equal(pressed.status, "resolved", JSON.stringify(pressed));
});
