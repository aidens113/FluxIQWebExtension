import assert from "node:assert/strict";
import { AutomationStudioService, validateStateSnapshot } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "./constants";
import { webAutomationRecordingDomain } from "./recording/domain";
import { createWebAutomationInitialState } from "./recording/state";
import { createWebAutomationRecordingEvent } from "./client/gateway-mapping";
import { WEB_AUTOMATION_INPUT_IDS, webAutomationInputIdForRecordedEvent, actionInputDefinitions, stateInputDefinitions } from "./io/input-model";
import { createWebAutomationStateFromSnapshot, filterStateElements } from "./recording/web-state";

const service = new AutomationStudioService({ seedFixture: false });
service.registerRecordingDomain(webAutomationRecordingDomain);

const validation = service.validateRecordingDomainEvent({
  recordingId: "recording.test",
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  eventType: WEB_AUTOMATION_EVENTS.elementClicked,
  payload: { url: "https://example.test", title: "Example", sequence: 1 }
});
assert.equal(validation.ok, true);

const event = createWebAutomationRecordingEvent({
  kind: "dom.click",
  sequence: 1,
  url: "https://example.test",
  title: "Example",
  eventTimestampMs: 10,
  element: { selector: "button" }
});
assert.equal(event.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(event.eventType, WEB_AUTOMATION_EVENTS.elementClicked);

const initialState = createWebAutomationInitialState(1);
assert.equal(initialState.namespaces.web?.schemaId, WEB_AUTOMATION_DOMAIN_ID);

const filteredElements = filterStateElements([
  { tagName: "button", selector: "button.icon" },
  { tagName: "button", selector: "button.save", text: "Save", bounds: { x: 20, y: 30, width: 80, height: 32 } },
  { tagName: "a", selector: "a.home", href: "https://example.test/home", bounds: { x: 120, y: 30, width: 96, height: 24 } },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" }, bounds: { x: 20, y: 80, width: 240, height: 36 } }
]);
assert.deepEqual(filteredElements.map((item) => item.selector), ["button.save", "a.home", "input[name=search]"]);

const prioritizedElements = filterStateElements([
  { tagName: "section", selector: "section.hero", attributes: { id: "hero" }, bounds: { x: 0, y: 0, width: 800, height: 300 } },
  { tagName: "p", selector: "p.summary", text: "Account summary", bounds: { x: 20, y: 120, width: 220, height: 24 } },
  { tagName: "button", selector: "button.deposit", text: "Deposit", bounds: { x: 20, y: 40, width: 90, height: 36 } },
  { tagName: "div", selector: "div.empty", bounds: { x: 20, y: 180, width: 100, height: 20 } }
]);
assert.deepEqual(prioritizedElements.map((item) => item.selector), ["button.deposit", "p.summary", "section.hero"]);

const repeatedNamedControlsState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/preferences",
  title: "Preferences",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
  interactiveElements: [
    { tagName: "input", selector: "form > label:nth-of-type(1) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 10, width: 16, height: 16 } },
    { tagName: "input", selector: "form > label:nth-of-type(2) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 40, width: 16, height: 16 } }
  ]
}, { timestamp: 18 });
assert.equal(repeatedNamedControlsState.namespaces.web?.values["elements.count"]?.value, 2);

const snapshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/search",
  title: "Search",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 25 },
  interactiveElements: filteredElements
}, {
  timestamp: 20,
  sourceId: "tab:1",
  projectId: "project.test",
  screenContentRef: "automation-object://project/project.test/0000000000000000000000000000000000000000000000000000000000000000"
});
const webValues = snapshotState.namespaces.web?.values ?? {};
assert.equal(webValues["page.url"]?.value, "https://example.test/search");
assert.equal(webValues["scroll.position"]?.type, "point");
assert.equal(webValues["elements.count"]?.value, 3);
assert.equal(Object.keys(webValues).some((path) => path.includes("button.icon")), false);
assert.equal(Object.keys(webValues).some((path) => path.endsWith(".selector")), true);
assert.equal(snapshotState.presentation?.defaultFrameId, "screen");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.rendererId, "web-automation.viewport");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers[0]?.id, "screenshot");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers.some((layer) => layer.kind === "region"), true);
assert.equal(webValues["elements.button.save.bounds"]?.presentation?.anchor?.type, "bounds");
assert.equal(validateStateSnapshot(snapshotState).ok, true);

assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.click", url: "https://example.test", title: "Example", sequence: 2 }), WEB_AUTOMATION_INPUT_IDS.elementClicked);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.input", url: "https://example.test", title: "Example", sequence: 3, inputValue: "hello" }), WEB_AUTOMATION_INPUT_IDS.textEntered);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.input", url: "https://example.test", title: "Example", sequence: 4, inputValue: "" }), WEB_AUTOMATION_INPUT_IDS.fieldCleared);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.change", url: "https://example.test", title: "Example", sequence: 5, element: { tagName: "select" }, inputValue: "two" }), WEB_AUTOMATION_INPUT_IDS.optionSelected);
assert.equal(webAutomationInputIdForRecordedEvent({ kind: "dom.submit", url: "https://example.test", title: "Example", sequence: 6 }), undefined);

assert.deepEqual(actionInputDefinitions.find(([id]) => id === WEB_AUTOMATION_INPUT_IDS.elementClicked), [WEB_AUTOMATION_INPUT_IDS.elementClicked, "Element clicked", "web.dom.click"]);
assert.equal(stateInputDefinitions.every((input) => input.role !== "action"), true);

console.log("Web automation domain smoke test passed.");
