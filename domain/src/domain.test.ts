import assert from "node:assert/strict";
import { AutomationStudioService } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "./constants";
import { webAutomationRecordingDomain } from "./recording/domain";
import { createWebAutomationInitialState } from "./recording/state";
import { createWebAutomationRecordingEvent } from "./client/gateway-mapping";
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
  { tagName: "button", selector: "button.save", text: "Save" },
  { tagName: "a", selector: "a.home", href: "https://example.test/home" },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" } }
]);
assert.deepEqual(filteredElements.map((item) => item.selector), ["button.save", "a.home", "input[name=search]"]);

const snapshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/search",
  title: "Search",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 25 },
  interactiveElements: filteredElements
}, { timestamp: 20, sourceId: "tab:1" });
const webValues = snapshotState.namespaces.web?.values ?? {};
assert.equal(webValues["page.url"]?.value, "https://example.test/search");
assert.equal(webValues["scroll.position"]?.type, "point");
assert.equal(webValues["elements.count"]?.value, 3);
assert.equal(Object.keys(webValues).some((path) => path.includes("button.icon")), false);
assert.equal(Object.keys(webValues).some((path) => path.endsWith(".selector")), true);

console.log("Web automation domain smoke test passed.");
