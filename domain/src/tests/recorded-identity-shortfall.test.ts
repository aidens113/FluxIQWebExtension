// A recorded step whose control would be found by one attribute alone (t425).
//
// It is still proposed -- the person recorded it, and dropping it would lose an
// act they took without a word -- and its proposal says why it may not be found
// again, so the person reviewing the recording is told before they save it. A
// recorded control the page describes in more ways is proposed as it always was.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioRecordingMapperObservation } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID } from "..";
import { createWebAutomationRecordingEvent } from "../client";
import { mapWebRecordingObservation } from "../web-panel-host";

type RecordedElement = Parameters<typeof createWebAutomationRecordingEvent>[0]["element"];

function recordedClick(element: RecordedElement): AutomationStudioRecordingMapperObservation {
  const wire = createWebAutomationRecordingEvent({ kind: "dom.click", sequence: 1, url: "https://shop.test/item", title: "Item", eventTimestampMs: 100, element });
  return {
    observationId: "observation.click",
    recordingId: "recording.test",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    type: "observation",
    timestamp: 100,
    payload: { observationType: wire.eventType, payload: wire.payload ?? {} },
    metadata: wire.metadata ?? {}
  };
}

test("a recorded control known only by the id its selector names is proposed with the reason it may not be found again", () => {
  const proposed = mapWebRecordingObservation(recordedClick({ selector: "#fb1l6ufkg", tagName: "div", id: "fb1l6ufkg" }));
  assert.equal(proposed?.outputId, "web.dom.click");
  assert.match(proposed?.description ?? "", /too little to be found again/u);
});

test("a recorded control the page describes in more ways is proposed with no such word", () => {
  const proposed = mapWebRecordingObservation(recordedClick({ selector: "#add", tagName: "button", id: "add", visibleText: "Add to cart", classNames: ["btn", "primary"] }));
  assert.equal(proposed?.outputId, "web.dom.click");
  assert.equal(proposed?.description, undefined);
});

// A click the extension recorded through its action input reaches the mapper as
// Core's `action` entry, its parameters already made by the same builder
// (`io/web-automation-io.ts` -> `output-nodes/payloads.ts`). It is judged the same way.
test("a recorded action entry whose control is known by one attribute alone carries the same reason", () => {
  const entry = (element: Record<string, unknown>): AutomationStudioRecordingMapperObservation => ({
    observationId: "observation.action",
    recordingId: "recording.test",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    type: "action",
    timestamp: 100,
    payload: { outputId: "web.dom.click", parameters: { selector: String(element.selector), element: JSON.parse(JSON.stringify(element)) } },
    metadata: { inputId: "web.input.element_clicked" }
  });
  assert.match(mapWebRecordingObservation(entry({ tagName: "div", selector: "#fbx7", id: "fbx7" }))?.description ?? "", /too little to be found again/u);
  assert.equal(mapWebRecordingObservation(entry({ tagName: "button", selector: "#add", visibleText: "Add to cart" }))?.description, undefined);
});
