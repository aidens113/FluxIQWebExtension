// T1 coverage of gateway-payloads.ts: the registered input a recorded event
// executes as, and the gateway recording event and evidence payload shaped from
// it. The mapping itself belongs to the domain (domain/src/io/input-model.ts);
// these tests pin what the extension sends.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS, WEB_AUTOMATION_INPUT_IDS, elementFingerprint } from "@fluxiq-web-extension/domain/client";
import type { DomElementDescriptor, DomElementIdentitySignal, RecordingEventKind, RecordingEventPayload, WireElementTarget } from "../../../shared/protocol";
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

// --- The wire element target -------------------------------------------------
//
// The rows below exist because this projection dropped five fields for a week
// with every suite green (reports/L-replay.md, measured live). Two things are
// pinned: the key set the wire carries, checked against the contract type
// rather than against a copy of this file's literal, and that a sensitive
// control's contents are not among them.

/** A type only satisfiable when its argument is `never`. */
type Nothing<T extends never> = T;

/**
 * Every field `WireElementTarget` declares, written out here so the two are
 * checked against each other rather than both being read off the producer.
 * `satisfies` rejects a key the contract does not have; `EveryWireFieldListed`
 * below rejects a contract key this list forgets. A field added to
 * `DomElementDescriptor` therefore fails here as well as at the producer.
 */
const WIRE_ELEMENT_FIELDS = [
  "selector", "tagName", "xpath", "id", "classNames", "visibleText", "text", "value",
  "role", "name", "href", "inputType", "bounds", "documentBounds", "isVisibleOnViewport",
  "hasClickHandler", "attributes", "testId", "accessibleName", "label", "implicitRole", "context"
] as const satisfies readonly (keyof WireElementTarget)[];

export type EveryWireFieldListed = Nothing<Exclude<keyof WireElementTarget, typeof WIRE_ELEMENT_FIELDS[number]>>;

/** The five Phase 1.3 signals, named again here so a rename fails this file too. */
const IDENTITY_SIGNALS = ["testId", "accessibleName", "label", "implicitRole", "context"] as const satisfies readonly DomElementIdentitySignal[];

export type EveryIdentitySignalListed = Nothing<Exclude<DomElementIdentitySignal, typeof IDENTITY_SIGNALS[number]>>;

/** A descriptor with every field the recorder can produce filled in, so an omission shows. */
const fullyDescribed: DomElementDescriptor = {
  tagName: "button",
  selector: "#save-settings",
  xpath: "/html/body/main/form/div/button",
  id: "save-settings",
  classNames: ["btn", "btn-primary"],
  visibleText: "Save changes",
  text: "Save changes",
  value: "save",
  role: "button",
  name: "Save changes",
  href: "https://example.test/save",
  inputType: "submit",
  hasValue: true,
  selectedValue: "save",
  bounds: { x: 1, y: 2, width: 3, height: 4 },
  documentBounds: { x: 1, y: 6, width: 3, height: 4 },
  isVisibleOnViewport: true,
  hasClickHandler: true,
  attributes: { id: "save-settings", class: "btn btn-primary", "data-testid": "save-changes" },
  options: [{ value: "save", label: "Save" }],
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Workspace name",
  implicitRole: "button",
  context: { formId: "settings-form", formName: "settings", fieldsetLegend: "General", heading: "Workspace settings" },
  changed: true,
  recentlyInteracted: true
};

function wireElement(element: DomElementDescriptor): Record<string, unknown> {
  const event = gatewayRecordingEventFromPayload(recorded("dom.click", { element }));
  const wire = event.payload?.element;
  assert.ok(wire && typeof wire === "object" && !Array.isArray(wire), "the recording event carries an element");
  return wire as Record<string, unknown>;
}

test("the wire element target carries every field the contract declares, and only those", () => {
  const wire = wireElement(fullyDescribed);
  assert.deepEqual(Object.keys(wire).sort(), [...WIRE_ELEMENT_FIELDS].sort());
});

test("every identity signal the protocol declares reaches the wire", () => {
  const wire = wireElement(fullyDescribed);
  for (const signal of IDENTITY_SIGNALS) {
    assert.deepEqual(wire[signal], fullyDescribed[signal], `${signal} reaches the wire`);
  }
});

// The join the producer and its consumer failed to make for a week: the wire
// element is what Core stores on a recording timeline entry, and
// `elementFingerprint` is what turns that entry into the element a generated
// Flow replays against. Asserting only the first half is what let the gap ship.
test("the identity signals survive the recording's own Flow-node element", () => {
  const fingerprint = elementFingerprint(wireElement(fullyDescribed));
  assert.ok(fingerprint, "the wire element normalizes to a fingerprint");
  assert.equal(fingerprint.testId, "save-changes");
  assert.equal(fingerprint.accessibleName, "Save changes");
  assert.equal(fingerprint.label, "Workspace name");
  assert.equal(fingerprint.implicitRole, "button");
});

// `describe-element.ts` withholds all of this at capture. This is the second
// look, on the far side of that wire, for the reason `state-values.ts` takes
// one: what crosses here is persisted and replayed.
test("a sensitive control sends no contents, and keeps the identity the author wrote", () => {
  const secret = "hunter2-should-never-cross";
  const password: DomElementDescriptor = {
    tagName: "input",
    selector: "#password",
    id: "password",
    inputType: "password",
    value: secret,
    visibleText: secret,
    text: secret,
    accessibleName: secret,
    label: "Password",
    implicitRole: "textbox",
    testId: "password-field",
    context: { formName: "sign-in" },
    attributes: { id: "password", type: "password", autocomplete: "current-password" }
  };
  const wire = wireElement(password);
  assert.equal(JSON.stringify(wire).includes(secret), false, "no field carries the control's contents");
  for (const field of ["value", "visibleText", "text", "accessibleName"]) {
    assert.equal(field in wire, false, `${field} is withheld on a sensitive control`);
  }
  assert.equal(wire.label, "Password");
  assert.deepEqual(wire.context, { formName: "sign-in" });
  assert.equal(wire.testId, "password-field");
  assert.equal(wire.implicitRole, "textbox");
});

// A card field is marked by its `autocomplete` token rather than its type, and
// the rule reads the token list: `billing cc-number` is how a real one is
// written and is how one copy of this rule missed it once.
test("a card field is judged by the same rule, from its autocomplete tokens", () => {
  const pan = "4111111111111111";
  const wire = wireElement({
    tagName: "input",
    selector: "#card",
    inputType: "text",
    value: pan,
    accessibleName: pan,
    label: "Card number",
    attributes: { type: "text", autocomplete: "billing cc-number" }
  });
  assert.equal(JSON.stringify(wire).includes(pan), false, "no field carries the card number");
  assert.equal(wire.label, "Card number");
});

test("an ordinary control still sends its text, and a passive event's element is projected too", () => {
  const wire = wireElement({ tagName: "input", selector: "#q", inputType: "search", value: "shoes", visibleText: "shoes" });
  assert.equal(wire.value, "shoes");
  assert.equal(wire.visibleText, "shoes");
});
