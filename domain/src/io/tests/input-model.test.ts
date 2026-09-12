// T1 coverage of the recording mapping table in
// docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-recording.md
// ("Mapping table: recording event -> input -> output -> executable"): one
// case per row, each asserting the domain event type, the live input, the
// registered output, the output node, and the output parameters.

import assert from "node:assert/strict";
import { WEB_AUTOMATION_ACTION_TYPES } from "../../actions/types";
import { WEB_AUTOMATION_EVENTS } from "../../constants";
import { listWebAutomationOutputNodeDefinitions, webAutomationOutputNodeId, webAutomationOutputPayload } from "../../output-nodes";
import {
  WEB_AUTOMATION_INPUT_IDS,
  actionInputDefinitions,
  stateInputDefinitions,
  webAutomationEventTypeForClientKind,
  webAutomationInputIdForRecordedEvent,
  webAutomationRecordedAction,
  type WebAutomationRecordedInputPayload
} from "../input-model";

const button = { selector: "#save", tagName: "button", text: "Save", xpath: "/html/body/form/button", id: "save", role: "button" };
const field = { selector: "input[name=q]", tagName: "input", inputType: "text", name: "q", xpath: "/html/body/form/input" };
const planSelect = { selector: "select#plan", tagName: "select", id: "plan" };
const termsCheckbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
const termsCheckboxChecked = { ...termsCheckbox, checked: true };
const planRadio = { selector: "input#plan-team", tagName: "input", inputType: "radio", id: "plan-team" };
const visualTarget = { namespace: "web", statePath: "web.elements.button.save", selector: "#save" };

function recorded(kind: string, extra: Partial<WebAutomationRecordedInputPayload> = {}): WebAutomationRecordedInputPayload {
  return { kind, url: "https://example.test/form", title: "Form", sequence: 1, ...extra };
}

type Row = {
  row: string;
  event: WebAutomationRecordedInputPayload;
  eventType: string;
  inputId?: string;
  outputId?: typeof WEB_AUTOMATION_ACTION_TYPES[number];
};

const rows: Row[] = [
  { row: "1 content.ready", event: recorded("content.ready"), eventType: WEB_AUTOMATION_EVENTS.clientReady },
  { row: "2 browser.tab", event: recorded("browser.tab"), eventType: WEB_AUTOMATION_EVENTS.tabStateChanged },
  {
    row: "3 browser.navigation, typed",
    event: recorded("browser.navigation", { metadata: { transition: "typed" } }),
    eventType: WEB_AUTOMATION_EVENTS.pageNavigated,
    inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested,
    outputId: "web.browser.navigate"
  },
  { row: "4 browser.navigation, not typed", event: recorded("browser.navigation", { metadata: { transition: "link" } }), eventType: WEB_AUTOMATION_EVENTS.pageNavigated },
  {
    row: "5 dom.click",
    event: recorded("dom.click", { element: button }),
    eventType: WEB_AUTOMATION_EVENTS.elementClicked,
    inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked,
    outputId: "web.dom.click"
  },
  {
    row: "6 dom.input, non-empty",
    event: recorded("dom.input", { element: field, inputValue: "ada" }),
    eventType: WEB_AUTOMATION_EVENTS.elementInputChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.textEntered,
    outputId: "web.dom.type"
  },
  {
    row: "7 dom.input, empty value",
    event: recorded("dom.input", { element: field, inputValue: "" }),
    eventType: WEB_AUTOMATION_EVENTS.elementInputChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared,
    outputId: "web.dom.clear"
  },
  {
    row: "8 dom.change, <select>",
    event: recorded("dom.change", { element: planSelect, inputValue: "team" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected,
    outputId: "web.dom.select"
  },
  {
    // A checkbox is set, not typed into. Without a recorded checked state the
    // replay would have to guess between checking and unchecking, so the
    // toggle stays evidence rather than becoming a wrong action.
    row: "9 dom.change, checkbox, no recorded state",
    event: recorded("dom.change", { element: termsCheckbox, inputValue: "on" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged
  },
  {
    row: "9a dom.change, checkbox with a recorded state",
    event: recorded("dom.change", { element: termsCheckboxChecked, inputValue: "on" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.checkboxToggled,
    outputId: "web.dom.check"
  },
  {
    // A radio's change can only mean "now selected", so it needs no recorded state.
    row: "9b dom.change, radio",
    event: recorded("dom.change", { element: planRadio, inputValue: "team" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.checkboxToggled,
    outputId: "web.dom.check"
  },
  { row: "10 dom.submit", event: recorded("dom.submit", { element: { selector: "form", tagName: "form" } }), eventType: WEB_AUTOMATION_EVENTS.formSubmitted },
  {
    row: "11 dom.keydown",
    event: recorded("dom.keydown", { element: field, key: "Enter" }),
    eventType: WEB_AUTOMATION_EVENTS.keyboardPressed,
    inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed,
    outputId: "web.dom.keypress"
  },
  {
    row: "12 dom.scroll",
    event: recorded("dom.scroll", { scroll: { x: 0, y: 640 }, metadata: { sourceEvent: "wheel", deltaY: 120 } }),
    eventType: WEB_AUTOMATION_EVENTS.scrollChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled,
    outputId: "web.dom.scroll"
  },
  { row: "13 dom.wheel, never emitted", event: recorded("dom.wheel", { scroll: { x: 0, y: 640 } }), eventType: WEB_AUTOMATION_EVENTS.mouseWheel },
  { row: "14 dom.mutation", event: recorded("dom.mutation"), eventType: WEB_AUTOMATION_EVENTS.domMutated },
  { row: "15 dom.focus, never emitted", event: recorded("dom.focus", { element: field }), eventType: WEB_AUTOMATION_EVENTS.elementFocused },
  { row: "16 dom.blur, never emitted", event: recorded("dom.blur", { element: field }), eventType: WEB_AUTOMATION_EVENTS.elementBlurred },
  { row: "17 dom.snapshot, never emitted", event: recorded("dom.snapshot"), eventType: WEB_AUTOMATION_EVENTS.snapshotCaptured },
  { row: "18 action.result", event: recorded("action.result"), eventType: WEB_AUTOMATION_EVENTS.actionExecuted },
  { row: "19 client.error, never emitted", event: recorded("client.error"), eventType: WEB_AUTOMATION_EVENTS.clientError }
];

const outputNodes = listWebAutomationOutputNodeDefinitions();

for (const { row, event, eventType, inputId, outputId } of rows) {
  assert.equal(webAutomationEventTypeForClientKind(event.kind), eventType, `row ${row}: domain event type`);
  assert.equal(webAutomationInputIdForRecordedEvent(event), inputId, `row ${row}: live input`);
  const action = webAutomationRecordedAction(eventType, event, event.metadata);
  assert.equal(action?.inputId, inputId, `row ${row}: mapped input`);
  assert.equal(action?.outputId, outputId, `row ${row}: registered output`);
  if (inputId === undefined || outputId === undefined) continue;
  assert.equal(actionInputDefinitions.find(([id]) => id === inputId)?.[2], outputId, `row ${row}: input definition names the output`);
  const node = outputNodes.find((definition) => definition.outputAction?.fixedOutputId === outputId);
  assert.equal(node?.id, webAutomationOutputNodeId(outputId), `row ${row}: output node`);
  assert.deepEqual(action?.parameters, webAutomationOutputPayload(outputId, event), `row ${row}: parameters equal the live output binding payload`);
}

// Row 12 is the fix: the scroll input is keyed on `dom.scroll`, which the recorder emits.
assert.equal(webAutomationOutputNodeId("web.dom.scroll"), "web.output.dom-scroll");
assert.deepEqual(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.scrollChanged, { scroll: { x: 0, y: 640 } })?.parameters, { x: 0, y: 640 });
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.mouseWheel, { scroll: { x: 0, y: 640 } }), undefined);

// Parameters keep the full element fingerprint and visual target, so replay can fall back when the selector drifts.
const click = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementClicked, { element: button, visualTarget });
assert.equal(click?.parameters.selector, "#save");
assert.deepEqual(click?.parameters.element, { selector: "#save", xpath: "/html/body/form/button", id: "save", tagName: "button", text: "Save", role: "button" });
assert.deepEqual(click?.parameters.visualTarget, visualTarget);
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementInputChanged, { element: field, inputValue: "ada" })?.parameters.text, "ada");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementChanged, { element: planSelect, inputValue: "team" })?.parameters.value, "team");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.keyboardPressed, { element: field, key: "Enter" })?.parameters.key, "Enter");
assert.deepEqual(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.pageNavigated, { url: "https://example.test/next" }, { transition: "typed" })?.parameters, { url: "https://example.test/next" });

// Navigation: only a typed navigation that is not the recording's starting point is a user action.
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation")), undefined);
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation", { metadata: { reason: "recording_start" } })), undefined);
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation", { metadata: { reason: "recording_start", transition: "typed" } })), undefined);

// An event is executable only when its output's required parameters are present.
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation", { url: "", metadata: { transition: "typed" } })), undefined, "navigation needs a URL");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.click")), undefined, "click needs a target selector");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.input", { inputValue: "ada" })), undefined, "text entry needs a target selector");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.change", { element: { tagName: "select" }, inputValue: "team" })), undefined, "select needs a target selector");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.keydown", { element: field })), undefined, "key press needs a key");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.keydown", { key: "Escape" })), WEB_AUTOMATION_INPUT_IDS.keyPressed, "a key press may target the focused element");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.scroll")), undefined, "scroll needs a coordinate");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.scroll", { scroll: { y: 0 } })), WEB_AUTOMATION_INPUT_IDS.pageScrolled, "scrolling back to the top is a coordinate");

// Outputs with no recording input: dispatch-only, never produced from a user action.
const recordableOutputs: string[] = actionInputDefinitions.map(([, , outputId]) => outputId);
const dispatchOnlyOutputs = [
  "web.dom.wait_for_selector", "web.dom.wait_for_text", "web.dom.extract", "web.dom.capture_snapshot",
  // Added in Week 1 (decision D6). `web.dom.check` is recordable, from a
  // checkbox or radio change; the other six are authored or driven by a Flow
  // and no recorded user event produces one.
  "web.dom.assert", "web.dom.extract_list", "web.dom.upload", "web.dom.dialog",
  "web.browser.tab", "web.browser.download"
];
assert.equal(new Set(recordableOutputs).size, recordableOutputs.length, "each action input maps to its own output");
assert.deepEqual([...recordableOutputs, ...dispatchOnlyOutputs].sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort(), "every output is recordable or dispatch-only");
for (const outputId of dispatchOnlyOutputs) {
  assert.equal(recordableOutputs.includes(outputId), false, `${outputId} is dispatch-only`);
}

// State and evidence inputs never become executable.
assert.equal(stateInputDefinitions.every((input) => (input.role as string) !== "action"), true);
const stateInputIds: string[] = stateInputDefinitions.map((input) => input.id);
for (const { event, eventType } of rows) {
  const inputId = webAutomationRecordedAction(eventType, event, event.metadata)?.inputId;
  assert.equal(inputId !== undefined && stateInputIds.includes(inputId), false);
}

console.log("Web automation input model tests passed.");
