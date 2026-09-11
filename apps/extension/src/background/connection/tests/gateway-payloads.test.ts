// T1 coverage of gateway-payloads.ts: the registered input a recorded event
// executes as, and the gateway recording event and evidence payload shaped from
// it. The mapping itself belongs to the domain (domain/src/io/input-model.ts);
// these tests pin what the extension sends.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS, WEB_AUTOMATION_INPUT_IDS } from "@fluxiq-web-extension/domain/client";
import type { DomElementDescriptor, RecordingEventKind, RecordingEventPayload } from "../../../shared/protocol";
import { gatewayRecordingEventFromPayload, recordedInputId, recordingEvidencePayload } from "../gateway-payloads";

const button: DomElementDescriptor = { tagName: "button", selector: "#submit", name: "Place order", bounds: { x: 10, y: 20, width: 80, height: 30 } };
const searchField: DomElementDescriptor = { tagName: "input", selector: "#q", inputType: "search" };
const sizeSelect: DomElementDescriptor = { tagName: "select", selector: "#size" };

function recorded(kind: RecordingEventKind, overrides: Partial<RecordingEventPayload> = {}): RecordingEventPayload {
  return { kind, sequence: 4, url: "https://example.test/checkout", title: "Checkout", eventTimestampMs: 1_000, ...overrides };
}

function statePathOf(value: unknown): unknown {
  return value && typeof value === "object" && "statePath" in value ? value.statePath : undefined;
}

test("a recorded event maps to the registered input it executes as, or to none", () => {
  const rows: Array<[label: string, payload: RecordingEventPayload, inputId: string | undefined]> = [
    ["a click on an element", recorded("dom.click", { element: button }), WEB_AUTOMATION_INPUT_IDS.elementClicked],
    ["text typed", recorded("dom.input", { element: searchField, inputValue: "shoes" }), WEB_AUTOMATION_INPUT_IDS.textEntered],
    ["a field emptied", recorded("dom.input", { element: searchField, inputValue: "" }), WEB_AUTOMATION_INPUT_IDS.fieldCleared],
    ["an option chosen", recorded("dom.change", { element: sizeSelect, inputValue: "m" }), WEB_AUTOMATION_INPUT_IDS.optionSelected],
    ["a key pressed", recorded("dom.keydown", { element: searchField, key: "Enter" }), WEB_AUTOMATION_INPUT_IDS.keyPressed],
    ["a page scroll", recorded("dom.scroll", { scroll: { x: 0, y: 400 } }), WEB_AUTOMATION_INPUT_IDS.pageScrolled],
    ["a typed navigation", recorded("browser.navigation", { metadata: { transition: "typed" } }), WEB_AUTOMATION_INPUT_IDS.navigationRequested],
    ["the navigation that starts a recording", recorded("browser.navigation", { metadata: { transition: "typed", reason: "recording_start" } }), undefined],
    ["a link navigation", recorded("browser.navigation", { metadata: { transition: "link" } }), undefined],
    ["a click with no element", recorded("dom.click"), undefined],
    ["a focus change", recorded("dom.focus", { element: searchField }), undefined],
    ["a wheel event", recorded("dom.wheel", { scroll: { x: 0, y: 400 } }), undefined]
  ];
  for (const [label, payload, inputId] of rows) assert.equal(recordedInputId(payload), inputId, label);
});

test("an executable event carries its input id and visual target in metadata", () => {
  const event = gatewayRecordingEventFromPayload(recorded("dom.click", { element: button, metadata: { source: "pointer" } }), 7, 0, "rec-1");
  assert.equal(event.eventId, "web.4.1000");
  assert.equal(event.recordingId, "rec-1");
  assert.equal(event.domainId, WEB_AUTOMATION_DOMAIN_ID);
  assert.equal(event.eventType, WEB_AUTOMATION_EVENTS.elementClicked);
  assert.equal(event.timestamp, 1_000);
  assert.equal(event.sourceId, "tab:7:frame:0");
  assert.equal(event.metadata?.inputId, WEB_AUTOMATION_INPUT_IDS.elementClicked);
  assert.equal(event.metadata?.clientKind, "dom.click");
  assert.equal(event.metadata?.source, "pointer");
  assert.equal(typeof statePathOf(event.metadata?.visualTarget), "string");
  assert.deepEqual(event.metadata?.visualTarget, event.payload?.visualTarget);
  assert.deepEqual(event.payload?.element, { tagName: "button", selector: "#submit", name: "Place order", bounds: { x: 10, y: 20, width: 80, height: 30 } });
});

test("a passive event carries no input id and keeps the recorder's metadata", () => {
  const event = gatewayRecordingEventFromPayload(recorded("dom.focus", { element: searchField, metadata: { reason: "tab-key" } }), 7);
  assert.equal(event.eventType, WEB_AUTOMATION_EVENTS.elementFocused);
  assert.equal(event.sourceId, "tab:7");
  assert.equal("recordingId" in event, false);
  assert.equal(event.metadata?.reason, "tab-key");
  assert.equal(event.metadata?.inputId, undefined);
});

test("an event from no tab has no source id, and no element means no visual target", () => {
  const event = gatewayRecordingEventFromPayload(recorded("dom.scroll", { scroll: { x: 0, y: 400 } }));
  assert.equal("sourceId" in event, false);
  assert.equal(event.metadata?.inputId, WEB_AUTOMATION_INPUT_IDS.pageScrolled);
  assert.equal(event.metadata?.visualTarget, undefined);
});

test("recording evidence keeps the event and derives a visual target from the element", () => {
  const evidence = recordingEvidencePayload(recorded("dom.focus", { element: searchField }));
  assert.equal(evidence.kind, "dom.focus");
  assert.equal(evidence.sequence, 4);
  assert.equal(evidence.timestamp, 1_000);
  assert.deepEqual(evidence.element, searchField);
  assert.equal(typeof statePathOf(evidence.visualTarget), "string");
  assert.equal("inputValue" in evidence, false);

  const scroll = recordingEvidencePayload(recorded("dom.scroll", { scroll: { x: 0, y: 400 } }));
  assert.deepEqual(scroll.scroll, { x: 0, y: 400 });
  assert.equal("element" in scroll, false);
  assert.equal("visualTarget" in scroll, false);
});
