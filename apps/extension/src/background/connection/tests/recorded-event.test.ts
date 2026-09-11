// T1 coverage of recorded-event.ts: which recorded events are executable
// actions, which need state evidence, and how they are identified and labelled
// in the activity log.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { DomElementDescriptor, RecordingEventKind, RecordingEventPayload } from "../../../shared/protocol";
import {
  activityDetail,
  activityLabel,
  clickEventSignature,
  isExecutableRecordedAction,
  isNavigationExplanation,
  shouldRequireStateForEvidence,
  stateScreenshotEventKey,
  stateSnapshotIdFromPayload
} from "../recorded-event";

const button: DomElementDescriptor = { tagName: "button", selector: "#submit", name: "Place order", text: "Place order" };
const searchField: DomElementDescriptor = { tagName: "input", selector: "#q", inputType: "search" };

function recorded(kind: RecordingEventKind, overrides: Partial<RecordingEventPayload> = {}): RecordingEventPayload {
  return { kind, sequence: 4, url: "https://example.test/checkout", title: "Checkout", eventTimestampMs: 1_000, ...overrides };
}

test("an event is executable only when it maps to a runnable output", () => {
  const rows: Array<[label: string, payload: RecordingEventPayload, executable: boolean]> = [
    ["a click on an element", recorded("dom.click", { element: button }), true],
    ["a click with no element to replay it on", recorded("dom.click"), false],
    ["text typed into a field", recorded("dom.input", { element: searchField, inputValue: "shoes" }), true],
    ["a key pressed", recorded("dom.keydown", { element: searchField, key: "Enter" }), true],
    ["a page scroll", recorded("dom.scroll", { scroll: { x: 0, y: 400 } }), true],
    ["a typed navigation", recorded("browser.navigation", { metadata: { transition: "typed" } }), true],
    ["a link navigation", recorded("browser.navigation", { metadata: { transition: "link" } }), false],
    ["a form submit", recorded("dom.submit", { element: button }), false],
    ["a focus change", recorded("dom.focus", { element: searchField }), false],
    ["a DOM mutation", recorded("dom.mutation", { mutation: { added: 2, removed: 0, attributes: 1, text: 0 } }), false]
  ];
  for (const [label, payload, executable] of rows) assert.equal(isExecutableRecordedAction(payload), executable, label);
});

test("user actions and navigations need state evidence; passive observations do not", () => {
  const rows: Array<[label: string, payload: RecordingEventPayload, required: boolean]> = [
    ["an executable scroll", recorded("dom.scroll", { scroll: { x: 0, y: 400 } }), true],
    ["a scroll with no position", recorded("dom.scroll"), false],
    ["a click, even with no element", recorded("dom.click"), true],
    ["a link navigation", recorded("browser.navigation"), true],
    ["a form submit", recorded("dom.submit"), true],
    ["a field change", recorded("dom.change"), true],
    ["a key press with no key", recorded("dom.keydown"), true],
    ["an action result", recorded("action.result"), true],
    ["a focus change", recorded("dom.focus", { element: searchField }), false],
    ["a DOM mutation", recorded("dom.mutation"), false],
    ["a snapshot", recorded("dom.snapshot"), false]
  ];
  for (const [label, payload, required] of rows) assert.equal(shouldRequireStateForEvidence(payload), required, label);
});

test("a click or a submit can explain a navigation", () => {
  assert.equal(isNavigationExplanation(recorded("dom.click")), true);
  assert.equal(isNavigationExplanation(recorded("dom.submit")), true);
  assert.equal(isNavigationExplanation(recorded("dom.input")), false);
});

test("state ids and screenshot keys are built from kind, sequence and timestamp", () => {
  const click = recorded("dom.click");
  assert.equal(stateScreenshotEventKey(click), "dom.click:4:1000");
  assert.equal(stateSnapshotIdFromPayload(click), "state.dom.click.4.1000");
  assert.equal(stateSnapshotIdFromPayload(recorded("dom click/odd" as string as RecordingEventKind)), "state.dom-click-odd.4.1000");
});

test("a click signature names tab, frame, selector and rounded bounds", () => {
  const placed = recorded("dom.click", { element: { ...button, bounds: { x: 10.4, y: 20.6, width: 30.5, height: 40.49 } } });
  assert.equal(clickEventSignature(placed, 7, 0), "7|0|#submit|10|21|31|40");
  assert.equal(clickEventSignature(recorded("dom.click", { element: button })), "tab|frame|#submit||||");
  assert.equal(clickEventSignature(recorded("dom.click")), undefined);
});

test("each event kind reads as its activity label", () => {
  const labels: Array<[kind: RecordingEventKind, label: string]> = [
    ["dom.click", "Click"],
    ["dom.input", "Input changed"],
    ["dom.change", "Field changed"],
    ["dom.submit", "Form submitted"],
    ["dom.wheel", "Mouse wheel"],
    ["dom.scroll", "Page scrolled"],
    ["dom.mutation", "DOM changed"],
    ["browser.navigation", "Navigation"],
    ["action.result", "Action result"],
    ["dom.focus", "dom.focus"],
    ["content.ready", "content.ready"]
  ];
  for (const [kind, label] of labels) assert.equal(activityLabel(recorded(kind)), label, kind);
  assert.equal(activityLabel(recorded("dom.keydown", { key: "Enter" })), "Key Enter");
  assert.equal(activityLabel(recorded("dom.keydown")), "Key");
});

test("an activity detail prefers the element's name, then its text, selector, scroll, mutation and URL", () => {
  assert.equal(activityDetail(recorded("dom.click", { element: button })), "Place order");
  assert.equal(activityDetail(recorded("dom.click", { element: { tagName: "a", selector: "#more", text: "More" } })), "More");
  assert.equal(activityDetail(recorded("dom.click", { element: { tagName: "div", selector: "#card" } })), "#card");
  assert.equal(activityDetail(recorded("dom.scroll", { scroll: { x: 0, y: 400 } })), "0, 400");
  assert.equal(activityDetail(recorded("dom.mutation", { mutation: { added: 2, removed: 1, attributes: 0, text: 0 } })), "2 added, 1 removed");
  assert.equal(activityDetail(recorded("browser.navigation")), "https://example.test/checkout");
  assert.equal(activityDetail(recorded("browser.navigation", { url: "" })), undefined);
});
